export const resizeImage = (file, maxDimension = 1500) => {
    return new Promise((resolve, reject) => {
        if (!file.type.match(/image.*/)) {
            reject(new Error("File is not an image"));
            return;
        }

        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            const image = new Image();
            image.onload = () => {
                let width = image.width;
                let height = image.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height *= maxDimension / width));
                        width = maxDimension;
                    } else {
                        width = Math.round((width *= maxDimension / height));
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(image, 0, 0, width, height);

                // Default to webp for better compression, fallback to jpeg
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve({ blob, width, height });
                    } else {
                        reject(new Error("Canvas to Blob failed"));
                    }
                }, "image/webp", 0.9);
            };
            image.onerror = () => reject(new Error("Failed to load image"));
            image.src = readerEvent.target.result;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
};
