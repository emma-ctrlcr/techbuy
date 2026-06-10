const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const QUALITY = {
    PRODUCT: 92,
    CAROUSEL: 95,
    THUMB: 85,
};

const SHARPEN_KERNEL = {
    sigma: 0.6,
    flat: 1.5,
    jagged: 1.0,
};

const THUMB_SIZES = [
    { suffix: '150w', width: 150 },
    { suffix: '300w', width: 300 },
    { suffix: '600w', width: 600 },
    { suffix: '1200w', width: 1200 },
];

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function resolvePath(url) {
    return path.join(__dirname, '..', '..', '..', url);
}

function isWebP(filename) {
    return /\.webp$/i.test(filename);
}

async function optimizeImage(buffer, originalFilename, uploadDir, imageType = 'product') {
    const quality = imageType === 'carousel' ? QUALITY.CAROUSEL : QUALITY.PRODUCT;
    const wasWebP = isWebP(originalFilename);
    const webpFilename = wasWebP ? originalFilename : originalFilename.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    const baseName = path.parse(webpFilename).name;
    const uploadBaseName = path.basename(uploadDir);

    ensureDir(uploadDir);

    const fullPath = path.join(uploadDir, webpFilename);

    if (wasWebP) {
        fs.writeFileSync(fullPath, buffer);
    } else {
        await sharp(buffer)
            .withMetadata()
            .toColorspace('srgb')
            .sharpen(SHARPEN_KERNEL)
            .webp({ quality, effort: 6, alphaQuality: 100, smartSubsample: true, mixed: true })
            .toFile(fullPath);
    }

    const result = {
        url: `/uploads/${uploadBaseName}/${webpFilename}`,
        sizes: {},
    };

    const thumbDir = path.join(uploadDir, 'thumbs');
    ensureDir(thumbDir);

    for (const size of THUMB_SIZES) {
        const thumbFilename = `${baseName}-${size.suffix}.webp`;
        const thumbPath = path.join(thumbDir, thumbFilename);
        try {
            await sharp(buffer)
                .resize(size.width, null, {
                    fit: 'inside',
                    withoutEnlargement: true,
                    kernel: 'lanczos3',
                })
                .withMetadata()
                .toColorspace('srgb')
                .sharpen({ sigma: 0.4, flat: 1.0, jagged: 0.8 })
                .webp({ quality: QUALITY.THUMB, effort: 6, alphaQuality: 100, smartSubsample: true, mixed: true })
                .toFile(thumbPath);

            result.sizes[size.suffix] = {
                url: `/uploads/${uploadBaseName}/thumbs/${thumbFilename}`,
                width: size.width,
            };
        } catch (err) {
            console.error(`[image-optimizer] Error generando thumbnail ${thumbFilename}:`, err);
        }
    }

    return result;
}

async function deleteImageFiles(url) {
    const basePath = resolvePath(url);
    const baseName = path.parse(basePath).name;
    const uploadDir = path.dirname(basePath);
    const thumbDir = path.join(uploadDir, 'thumbs');

    try {
        if (fs.existsSync(basePath)) fs.unlinkSync(basePath);
    } catch (e) {}

    for (const size of THUMB_SIZES) {
        const thumbPath = path.join(thumbDir, `${baseName}-${size.suffix}.webp`);
        try {
            if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        } catch (e) {}
    }
}

async function generateThumbnailsForExisting(url) {
    const basePath = resolvePath(url);
    if (!fs.existsSync(basePath)) return null;

    const buffer = fs.readFileSync(basePath);
    const filename = path.basename(basePath);
    const baseName = path.parse(filename).name;
    const uploadDir = path.dirname(basePath);
    const uploadBaseName = path.basename(uploadDir);
    const thumbDir = path.join(uploadDir, 'thumbs');
    ensureDir(thumbDir);

    const sizes = {};

    for (const size of THUMB_SIZES) {
        const thumbFilename = `${baseName}-${size.suffix}.webp`;
        const thumbPath = path.join(thumbDir, thumbFilename);

        if (fs.existsSync(thumbPath)) continue;

        await sharp(buffer)
            .resize(size.width, null, {
                fit: 'inside',
                withoutEnlargement: true,
                kernel: 'lanczos3',
            })
            .withMetadata()
            .toColorspace('srgb')
            .sharpen({ sigma: 0.4, flat: 1.0, jagged: 0.8 })
            .webp({ quality: QUALITY.THUMB, effort: 6, alphaQuality: 100, smartSubsample: true, mixed: true })
            .toFile(thumbPath);

        sizes[size.suffix] = {
            url: `/uploads/${uploadBaseName}/thumbs/${thumbFilename}`,
            width: size.width,
        };
    }

    return sizes;
}

module.exports = {
    optimizeImage,
    deleteImageFiles,
    generateThumbnailsForExisting,
    THUMB_SIZES,
};
