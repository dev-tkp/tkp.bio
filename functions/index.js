const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sharp = require("sharp");
const path = require("path");
const os = require("os");
const fs = require("fs");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage().bucket();

/**
 * Firebase Storage에 이미지가 업로드될 때 트리거되어
 * 이미지를 최적화하고 Firestore 문서의 URL을 업데이트합니다.
 */
exports.optimizeImage = functions
  .region("asia-northeast3") // 서울 리전
  .runWith({ memory: "1GB" }) // 이미지 처리를 위해 메모리 증설
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name; // 파일 경로 (e.g., 'posts/original-image.jpg')
    const contentType = object.contentType; // 파일 타입 (e.g., 'image/jpeg')
    const firestoreDocId = object.metadata?.firestoreDocId;

    // 1. 최적화 대상인지 확인
    // - 이미지 파일이 아니면 종료
    // - firestoreDocId 메타데이터가 없으면 종료 (직접 업로드 등)
    // - 이미 최적화된 파일이면 종료 (무한 루프 방지)
    if (!contentType.startsWith("image/")) {
      return functions.logger.log("This is not an image.");
    }
    if (!firestoreDocId) {
      return functions.logger.log("firestoreDocId metadata not found. Skipping.");
    }
    if (filePath.startsWith("posts/optimized/")) {
      return functions.logger.log("This is already an optimized image.");
    }

    functions.logger.log(`Optimizing image for doc: ${firestoreDocId}, path: ${filePath}`);

    // 2. 이미지 다운로드
    const bucketFile = storage.file(filePath);
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
    await bucketFile.download({ destination: tempFilePath });
    functions.logger.log("Image downloaded locally to", tempFilePath);

    // 3. 이미지 최적화 (sharp 사용)
    const optimizedFileName = `optimized_${path.basename(filePath)}`;
    const optimizedTempPath = path.join(os.tmpdir(), optimizedFileName);

    await sharp(tempFilePath)
      .resize({ width: 1080, withoutEnlargement: true }) // 너비 1080px로 리사이즈, 원본보다 작으면 확대 안함
      .webp({ quality: 80 }) // WebP 형식, 80% 품질로 압축
      .toFile(optimizedTempPath);

    functions.logger.log("Image optimized and saved to", optimizedTempPath);

    // 4. 최적화된 이미지 업로드
    const destination = `posts/optimized/${optimizedFileName}`;
    const [uploadedFile] = await storage.upload(optimizedTempPath, {
      destination: destination,
      metadata: {
        contentType: "image/webp",
        metadata: { firestoreDocId: firestoreDocId }, // 메타데이터 유지
      },
    });

    // 5. 파일 공개 및 URL 업데이트
    await uploadedFile.makePublic();
    const publicUrl = uploadedFile.publicUrl();
    functions.logger.log("Optimized image uploaded. Public URL:", publicUrl);

    await db.collection("posts").doc(firestoreDocId).update({
      "background.url": publicUrl,
      "background.type": "image", // WebP는 이미지 타입
    });

    functions.logger.log(`Firestore doc ${firestoreDocId} updated successfully.`);

    // 6. 임시 파일 및 원본 파일 삭제
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(optimizedTempPath);
    await bucketFile.delete(); // 원본 파일 삭제

    return functions.logger.log("Cleanup finished.");
  });

/**
 * Firebase Storage에 비디오가 업로드될 때 트리거되어
 * 비디오를 웹 스트리밍에 최적화하고 Firestore 문서의 URL을 업데이트합니다.
 */
exports.optimizeVideo = functions
  .region("asia-northeast3") // 서울 리전
  .runWith({ timeoutSeconds: 300, memory: "2GB" }) // 비디오 처리를 위해 타임아웃(최대 540초)과 메모리(최대 2GB)를 늘립니다.
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;
    const firestoreDocId = object.metadata?.firestoreDocId;

    // 1. 최적화 대상인지 확인
    if (!contentType.startsWith("video/")) {
      return functions.logger.log("This is not a video.");
    }
    if (!firestoreDocId) {
      return functions.logger.log("firestoreDocId metadata not found. Skipping.");
    }
    if (filePath.startsWith("posts/optimized/")) {
      return functions.logger.log("This is already an optimized video.");
    }

    functions.logger.log(`Optimizing video for doc: ${firestoreDocId}, path: ${filePath}`);

    // 2. 비디오 다운로드
    const bucketFile = storage.file(filePath);
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
    await bucketFile.download({ destination: tempFilePath });
    functions.logger.log("Video downloaded locally to", tempFilePath);

    // 3. 비디오 최적화 (ffmpeg 사용)
    const optimizedFileName = `optimized_${path.basename(filePath)}.mp4`;
    const optimizedTempPath = path.join(os.tmpdir(), optimizedFileName);

    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .outputOptions([
          "-c:v libx264",       // H.264 코덱 사용
          "-preset fast",       // 빠른 인코딩
          "-crf 23",            // 화질 설정 (18-28 범위가 일반적)
          '-vf "scale=720:-2"', // 너비 720px로 리사이즈, 비율 유지
          "-c:a aac",           // AAC 오디오 코덱
          "-b:a 128k",          // 오디오 비트레이트
          "-movflags +faststart", // 웹 스트리밍 최적화
        ])
        .on("end", resolve)
        .on("error", reject)
        .save(optimizedTempPath);
    });

    functions.logger.log("Video optimized and saved to", optimizedTempPath);

    // 4. 최적화된 비디오 업로드 및 공개
    const destination = `posts/optimized/${optimizedFileName}`;
    const [uploadedFile] = await storage.upload(optimizedTempPath, { destination, public: true });
    const publicUrl = uploadedFile.publicUrl();
    functions.logger.log("Optimized video uploaded. Public URL:", publicUrl);

    // 5. Firestore 문서 업데이트
    await db.collection("posts").doc(firestoreDocId).update({ "background.url": publicUrl, "background.type": "video" });
    functions.logger.log(`Firestore doc ${firestoreDocId} updated successfully.`);

    // 6. 임시 파일 및 원본 파일 삭제
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(optimizedTempPath);
    await bucketFile.delete();

    return functions.logger.log("Video cleanup finished.");
  });