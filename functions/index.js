// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const fetch = require("node-fetch");

// Firebase Admin SDK 초기화
admin.initializeApp();

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
 * 포스트 생성의 핵심 로직을 수행합니다.
 * @param {object} event - Slack 이벤트 객체.
 * @param {FirebaseFirestore.DocumentReference} queueDocRef - Firestore 큐 문서 참조.
 */
async function _executePostCreation(event, queueDocRef) {
  // 1. Slack에서 사용자 정보 가져오기
  let authorName = "tkpar";
  let authorProfilePic = "/assets/profile_pic.png";
  try {
    console.log(`[BACKGROUND] Fetching user info for: ${event.user}`);
    const userInfoUrl = new URL("https://slack.com/api/users.info");
    userInfoUrl.searchParams.set("user", event.user);

    const slackBotToken = functions.config().slack.bot_token;
    if (!slackBotToken) {
      throw new Error(
          "SLACK_BOT_TOKEN is not set in Firebase Functions config.",
      );
    }

    const userInfoResponse = await fetch(userInfoUrl.toString(), {
      headers: {Authorization: `Bearer ${slackBotToken}`},
    });

    const userInfoData = await userInfoResponse.json();
    if (!userInfoData.ok) {
      throw new Error(`Slack API error for user info: ${userInfoData.error}`);
    }

    const {user: slackUser} = userInfoData;
    authorName = slackUser.profile.display_name ||
      slackUser.real_name || slackUser.name;
    authorProfilePic = slackUser.profile.image_512 ||
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
    console.log(`[BACKGROUND] Processing file: ${file.name}`);
    // 이 블록 내에서 에러가 발생하면 바깥 catch에서 잡아서 재시도 로직을 태웁니다.
    const slackBotToken = functions.config().slack.bot_token;
    const fileResponse = await fetch(file.url_private_download, {
      headers: {Authorization: `Bearer ${slackBotToken}`},
    });

    if (!fileResponse.ok) {
      throw new Error(`File download failed: ${fileResponse.statusText}`);
    }

    const fileBuffer = await fileResponse.buffer();
    const sizeInMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[BACKGROUND] File downloaded. Size: ${sizeInMB} MB.`);

    const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
    const destination = `posts/${uniqueFileName}`;
    const storageFile = storage.file(destination);

    await storageFile.save(fileBuffer, {
      metadata: {contentType: file.mimetype},
    });
    await storageFile.makePublic();

    background = {
      type: file.mimetype.startsWith("video/") ? "video" : "image",
      url: storageFile.publicUrl(),
    };
    console.log(`[BACKGROUND] File uploaded. Public URL: ${background.url}`);
  }

  // 3. 'posts' 컬렉션에 최종 포스트 문서 생성
  const newPost = {
    author: authorName,
    profilePic: authorProfilePic,
    content: event.text || "",
    createdAt: FieldValue.serverTimestamp(),
    background: background,
  };

  await db.collection("posts").add(newPost);
  console.log(
      "[BACKGROUND] Successfully created new post in 'posts' collection.",
  );

  // 4. 성공적으로 처리된 큐 문서 삭제
  await queueDocRef.delete();
  console.log(
      `[BACKGROUND] Process complete. Deleted queue doc: ${queueDocRef.id}`,
  );
}

// 함수 실행 옵션: 타임아웃 2분, 메모리 512MB로 설정
const runtimeOpts = {
  timeoutSeconds: 120,
  memory: "512MB",
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
            `[onCreate CRITICAL ERROR] Failed to process queue doc ${docId}:`,
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
      const configuredSecret = functions.config().reprocess.secret;

      if (!configuredSecret || secret !== configuredSecret) {
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
        const currentAttempts = data.attempts || 1;
        if (currentAttempts >= MAX_RETRIES) {
          const message = `최대 재시도 횟수(${MAX_RETRIES})를 초과하여 ` +
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
