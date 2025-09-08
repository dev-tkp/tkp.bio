// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const fetch = require("node-fetch");
const sharp = require("sharp");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const os = require("os");
const path = require("path");
const fs = require("fs").promises;

// Firebase Admin SDK 초기화
admin.initializeApp();

// fluent-ffmpeg에 바이너리 경로 설정
ffmpeg.setFfmpegPath(ffmpegPath);

const db = admin.firestore();
const storage = admin.storage().bucket();
const {FieldValue} = admin.firestore;

const MAX_RETRIES = 3; // 최대 재시도 횟수

/**
 * Slack에 에러 알림을 보냅니다.
 * @param {string} message - 슬랙으로 보낼 메시지.
 */
async function sendSlackNotification(message) {
  const webhookUrl = functions.config().slack.webhook_url;
  if (!webhookUrl) {
    console.error(
        "Slack Webhook URL is not configured. Skipping notification.",
    );
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({text: message}),
    });
    console.log("Successfully sent Slack notification.");
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
  }
}

/**
 * 동영상 파일을 압축합니다.
 * @param {Buffer} buffer - 원본 동영상 파일 버퍼.
 * @return {Promise<Buffer>} 압축된 동영상 파일 버퍼.
 */
async function compressVideo(buffer) {
  const rdmId = crypto.randomUUID();
  const tempInPath = path.join(os.tmpdir(), `input-${rdmId}.mp4`);
  const tempOutPath = path.join(os.tmpdir(), `output-${rdmId}.mp4`);

  await fs.writeFile(tempInPath, buffer);

  return new Promise((resolve, reject) => {
    ffmpeg(tempInPath)
        .outputOptions([
          "-vf", "scale=w=720:h=-2", // 너비 720p로 리사이즈, 높이는 비율 유지
          "-c:v", "libx264", // H.264 코덱 사용
          "-preset", "veryfast", // 빠른 인코딩 속도
          "-crf", "28", // 화질 설정 (숫자가 클수록 압축률이 높고 화질은 낮아짐)
          "-c:a", "aac", // 오디오 코덱
          "-b:a", "128k", // 오디오 비트레이트
          "-movflags", "+faststart", // 웹 스트리밍 최적화
        ])
        .output(tempOutPath)
        .on("end", async () => {
          try {
            const compBuffer = await fs.readFile(tempOutPath);
            await fs.unlink(tempInPath);
            await fs.unlink(tempOutPath);
            resolve(compBuffer);
          } catch (err) {
            reject(err);
          }
        })
        .on("error", async (err) => {
          try {
            await fs.unlink(tempInPath);
            await fs.unlink(tempOutPath);
          } catch (e) {/* ignore cleanup errors */}
          reject(err);
        })
        .run();
  });
}

/**
 * 포스트 생성의 핵심 로직을 수행합니다.
 * @param {object} event - Slack 이벤트 객체.
 * @param {FirebaseFirestore.DocumentReference} queueDocRef - Firestore 큐 문서 참조.
 */
async function _executePostCreation(event, queueDocRef) {
  // 1. Slack에서 사용자 정보 가져오기
  let authorName = "tkpar";
  let authorPic = "/assets/profile_pic.png";
  try {
    console.log(`[BACKGROUND] Fetching user info for: ${event.user}`);
    const userUrl = new URL("https://slack.com/api/users.info");
    userUrl.searchParams.set("user", event.user);

    const botToken = functions.config().slack.bot_token;
    if (!botToken) {
      throw new Error(
          "SLACK_BOT_TOKEN is not set in Firebase Functions config.",
      );
    }

    const userRes = await fetch(userUrl.toString(), {
      headers: {Authorization: `Bearer ${botToken}`},
    });

    const userData = await userRes.json();
    if (!userData.ok) {
      throw new Error(`Slack API error for user info: ${userData.error}`);
    }

    const {user: slackUser} = userData;
    authorName = slackUser.profile.display_name ||
      slackUser.real_name || slackUser.name;
    authorPic = slackUser.profile.image_512 ||
      slackUser.profile.image_original ||
      "/assets/profile_pic.png";
    console.log(`[BACKGROUND] Fetched user info for: ${authorName}`);
  } catch (userError) {
    console.error(
        "[BACKGROUND ERROR] Fetching user info failed. Using defaults.",
        userError,
    );
  }

  // 2. 첨부 파일 처리 (다운로드 및 Storage 업로드)
  const file = event.files && event.files[0];
  let background = {type: "image", url: "/assets/post2_bg.gif"};

  if (file && (file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/"))) {
    console.log(
        `[BCKGRND] Processing: ${file.name}, Mime: ${file.mimetype}`,
    );

    const botToken = functions.config().slack.bot_token;
    const fileRes = await fetch(file.url_private_download, {
      headers: {Authorization: `Bearer ${botToken}`},
    });

    if (!fileRes.ok) {
      throw new Error(`File download failed: ${fileRes.statusText}`);
    }

    const fBuffer = await fileRes.buffer();
    const originalSizeInMB = (fBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[BCKGRND] downloaded. Orgnl size: ${originalSizeInMB} MB.`);

    // 파일 타입에 따라 분기 처리
    if (file.mimetype.startsWith("video/")) {
      // 비디오 압축
      console.log(`[BACKGROUND] Compressing video: ${file.name}`);
      const compBuffer = await compressVideo(fBuffer);

      const compressedSizeInMB = (
        compBuffer.length / 1024 / 1024
      ).toFixed(2);
      console.log(`[BCKGRND] Video compressed. Size: ${compressedSizeInMB}MB`);

      const unqFilename = `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
      const dest = `posts/${unqFilename}`;
      const fileRef = storage.file(dest);

      await fileRef.save(
          compBuffer,
          {metadata: {contentType: "video/mp4"}},
      );
      await fileRef.makePublic();

      background = {type: "video", url: fileRef.publicUrl()};
      console.log(
          `[BCKGRND] Compressed video uploaded. URL: ${background.url}`,
      );
    } else if (
      file.mimetype.startsWith("image/") && !file.mimetype.includes("gif")
    ) {
      // 이미지 압축 (GIF 제외)
      console.log(`[BACKGROUND] Compressing image: ${file.name}`);
      const compBuffer = await sharp(fBuffer)
          .resize({width: 1080, withoutEnlargement: true})
          .webp({quality: 80})
          .toBuffer();

      const compressedSizeInMB = (
        compBuffer.length / 1024 / 1024
      ).toFixed(2);
      console.log(`[BCKGRND] Image compressed. Size: ${compressedSizeInMB}MB`);

      const origName = file.name.substring(0, file.name.lastIndexOf("."));
      const rdmUuid = crypto.randomUUID();
      const unqFilename = `${Date.now()}-${rdmUuid}-${origName}.webp`;
      const dest = `posts/${unqFilename}`;
      const fileRef = storage.file(dest);

      await fileRef.save(
          compBuffer,
          {metadata: {contentType: "image/webp"}},
      );
      await fileRef.makePublic();

      background = {type: "image", url: fileRef.publicUrl()};
      console.log(
          `[BCKGRND] Compressed image uploaded. URL: ${background.url}`,
      );
    } else {
      // GIF는 원본 그대로 업로드
      const type = file.mimetype.startsWith("video/") ? "video" : "image";
      console.log(`[BACKGROUND] Uploading original ${type}: ${file.name}`);

      const unqFilename = `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
      const dest = `posts/${unqFilename}`;
      const fileRef = storage.file(dest);

      await fileRef.save(
          fBuffer,
          {metadata: {contentType: file.mimetype}},
      );
      await fileRef.makePublic();

      background = {type: type, url: fileRef.publicUrl()};
      console.log(`Original ${type} uploaded. URL: ${background.url}`);
    }
  }

  // 3. 'posts' 컬렉션에 최종 포스트 문서 생성
  const postData = {
    author: authorName,
    profilePic: authorPic,
    content: event.text || "",
    createdAt: FieldValue.serverTimestamp(),
    background: background,
  };

  await db.collection("posts").add(postData);
  console.log(
      "[BACKGROUND] Successfully created new post " +
      "in 'posts' collection.",
  );

  // 4. 성공적으로 처리된 큐 문서 삭제
  await queueDocRef.delete();
  console.log(
      `[BACKGROUND] Process complete. ` +
      `Deleted queue doc: ${queueDocRef.id}`,
  );
}

// 함수 실행 옵션
const runtimeOpts = {
  timeoutSeconds: 300, // 5분으로 타임아웃 증가
  memory: "1GB", // 1GB memory
};

exports.processPostQueue = functions
    .region("asia-northeast3")
    .runWith(runtimeOpts) // 타임아웃 및 메모리 설정 적용
    .firestore.document("post_queue/{docId}")
    .onCreate(async (snap, context) => {
      const queueDocRef = snap.ref;
      const data = snap.data();
      const {slackEvent: event} = data;
      const {docId} = context.params;

      console.log(`[onCreate] Processing queued message from docId: ${docId}`);

      try {
        await queueDocRef.update({status: "processing", attempts: 1});
        await _executePostCreation(event, queueDocRef);
      } catch (error) {
        console.error(
            `[onCreate CRITICAL ERROR] ` +
            `Failed to process queue doc ${docId}:`,
            error,
        );

        const errorMessage = `포스트 생성 실패 (docId: ${docId}): ${error.message}`;
        await sendSlackNotification(errorMessage);

        await queueDocRef.update({
          status: "failed",
          error: error.message,
          lastAttempt: FieldValue.serverTimestamp(),
        });
      }
    });

// 실패한 큐 아이템을 수동으로 재처리하기 위한 HTTP 트리거 함수
exports.reprocessFailedPost = functions
    .region("asia-northeast3")
    .runWith(runtimeOpts)
    .https.onRequest(async (req, res) => {
      // 간단한 보안: POST 메서드만 허용하고, 간단한 secret key 확인
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      const {docId, secret} = req.body;
      const reprocessSec = functions.config().reprocess.secret;

      if (!reprocessSec || secret !== reprocessSec) {
        return res.status(401).send("Unauthorized");
      }

      if (!docId) {
        return res.status(400).send("Missing 'docId' in request body.");
      }

      const queueDocRef = db.collection("post_queue").doc(docId);
      const docSnap = await queueDocRef.get();

      if (!docSnap.exists) {
        return res.status(404).send(`Document with id ${docId} not found.`);
      }

      const data = docSnap.data();
      if (data.status !== "failed") {
        const message = `Document ${docId} is not in 'failed' state. ` +
          `Current state: ${data.status}`;
        return res.status(400).send(message);
      }

      console.log(`[HTTP Reprocess] Retrying docId: ${docId}`);

      try {
        const attempts = data.attempts || 1;
        if (attempts >= MAX_RETRIES) {
          const message =
            `최대 재시도 횟수(${MAX_RETRIES})를 초과하여 ` +
            `더 이상 처리하지 않습니다. (docId: ${docId})`;
          await sendSlackNotification(message);
          console.warn(message);
          return res.status(400).send(message);
        }

        await queueDocRef.update({
          status: "reprocessing",
          attempts: FieldValue.increment(1),
        });

        await _executePostCreation(data.slackEvent, queueDocRef);

        res.status(200).send(
            `Successfully reprocessed and created post for docId: ${docId}`,
        );
      } catch (error) {
        console.error(
            `[HTTP Reprocess CRITICAL ERROR] ` +
            `Failed to reprocess queue doc ${docId}:`,
            error,
        );

        const errorMessage =
          `포스트 재처리 실패 (docId: ${docId}): ${error.message}`;
        await sendSlackNotification(errorMessage);

        await queueDocRef.update({
          status: "failed",
          error: error.message,
          lastAttempt: FieldValue.serverTimestamp(),
        });
        res.status(500).send(
            `Failed to reprocess docId ${docId}. Error: ${error.message}`,
        );
      }
    });
