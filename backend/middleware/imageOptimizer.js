const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * 이미지 리사이징 및 최적화 미들웨어
 */
const optimizeImage = async (filePath, options = {}) => {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 80,
        format = 'jpeg'
    } = options;

    try {
        const ext = path.extname(filePath).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

        if (!isImage) {
            return filePath; // 이미지가 아니면 원본 반환
        }

        const optimizedPath = filePath.replace(ext, `_optimized${ext}`);

        await sharp(filePath)
            .resize(maxWidth, maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality, progressive: true })
            .png({ quality, compressionLevel: 9 })
            .webp({ quality })
            .toFile(optimizedPath);

        // 원본 파일 삭제하고 최적화된 파일로 교체
        await fs.unlink(filePath);
        await fs.rename(optimizedPath, filePath);

        console.log(`✅ 이미지 최적화 완료: ${path.basename(filePath)}`);
        return filePath;

    } catch (error) {
        console.error('이미지 최적화 실패:', error);
        return filePath; // 실패 시 원본 반환
    }
};

/**
 * 썸네일 생성
 */
const createThumbnail = async (filePath, size = 200) => {
    try {
        const ext = path.extname(filePath);
        const thumbnailPath = filePath.replace(ext, `_thumb${ext}`);

        await sharp(filePath)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 70 })
            .toFile(thumbnailPath);

        console.log(`✅ 썸네일 생성 완료: ${path.basename(thumbnailPath)}`);
        return thumbnailPath;

    } catch (error) {
        console.error('썸네일 생성 실패:', error);
        return null;
    }
};

/**
 * 이미지 메타데이터 추출
 */
const getImageMetadata = async (filePath) => {
    try {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: metadata.size
        };
    } catch (error) {
        console.error('메타데이터 추출 실패:', error);
        return null;
    }
};

module.exports = {
    optimizeImage,
    createThumbnail,
    getImageMetadata
};
