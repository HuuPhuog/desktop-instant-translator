/**
 * ============================================
 * 📁 src/services/imageProcessor.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Tiền xử lý ảnh chuyên sâu trước khi gửi cho OCR (Tesseract.js).
 * Tối ưu hóa đặc biệt cho: Subtitles, YouTube, Dark Mode, Small Text.
 *
 * PIPELINE:
 * 1. Upscale (2x với Bilinear smoothing để làm mượt nét)
 * 2. Grayscale (Đơn sắc hóa)
 * 3. Contrast Stretching (Kéo giãn độ tương phản Min-Max)
 * 4. Gaussian Blur 3x3 (Khử nhiễu răng cưa anti-alias & JPEG artifacts)
 * 5. Sharpening Laplacian 3x3 (Làm nét biên chữ)
 * 6. Adaptive Thresholding (Nhị phân hóa thích nghi Bradley-Roth dùng Integral Image)
 * 7. Auto-inversion (Tự động chuyển thành chữ đen nền trắng)
 * ============================================
 */

export async function preprocessImageForOCR(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      try {
        // 1. UPSCALE: Phóng to 2x giúp Tesseract nhận dạng chữ nhỏ tốt hơn
        const scale = 2;
        const width = img.width * scale;
        const height = img.height * scale;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          return resolve(base64Image); // Fallback: Trả về ảnh gốc nếu không có context 2D
        }

        // Bật bilinear smoothing khi upscale để tránh răng cưa sắc cạnh, biên chữ mượt hơn
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const size = width * height;

        // Mảng lưu trữ mức xám tạm thời để xử lý ma trận và integral image
        const grayBuf = new Uint8ClampedArray(size);

        // 2. GRAYSCALE (Luminance formula)
        let minGray = 255;
        let maxGray = 0;

        for (let i = 0; i < size; i++) {
          const idx = i * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Công thức chuẩn độ sáng mắt người cảm nhận
          const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          grayBuf[i] = gray;

          if (gray < minGray) minGray = gray;
          if (gray > maxGray) maxGray = gray;
        }

        // 3. CONTRAST STRETCHING (Kéo giãn dải sắc độ về 0-255)
        if (maxGray > minGray) {
          const diff = maxGray - minGray;
          for (let i = 0; i < size; i++) {
            grayBuf[i] = Math.round(((grayBuf[i] - minGray) / diff) * 255);
          }
        }

        // 4. GAUSSIAN BLUR 3x3 (Khử nhiễu hạt và nhiễu răng cưa)
        // Kernel:
        // [ 1/16, 2/16, 1/16 ]
        // [ 2/16, 4/16, 2/16 ]
        // [ 1/16, 2/16, 1/16 ]
        const blurBuf = new Uint8ClampedArray(size);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
              blurBuf[idx] = grayBuf[idx];
              continue;
            }

            let sum = 0;
            sum += grayBuf[(y - 1) * width + (x - 1)] * 1;
            sum += grayBuf[(y - 1) * width + x] * 2;
            sum += grayBuf[(y - 1) * width + (x + 1)] * 1;
            sum += grayBuf[y * width + (x - 1)] * 2;
            sum += grayBuf[y * width + x] * 4;
            sum += grayBuf[y * width + (x + 1)] * 2;
            sum += grayBuf[(y + 1) * width + (x - 1)] * 1;
            sum += grayBuf[(y + 1) * width + x] * 2;
            sum += grayBuf[(y + 1) * width + (x + 1)] * 1;

            blurBuf[idx] = Math.round(sum / 16);
          }
        }

        // 5. SHARPENING LAPLACIAN 3x3 (Làm sắc biên nét chữ)
        // Kernel:
        // [  0, -1,  0 ]
        // [ -1,  5, -1 ]
        // [  0, -1,  0 ]
        const sharpBuf = new Uint8ClampedArray(size);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
              sharpBuf[idx] = blurBuf[idx];
              continue;
            }

            let val = blurBuf[idx] * 5;
            val -= blurBuf[(y - 1) * width + x];
            val -= blurBuf[y * width + (x - 1)];
            val -= blurBuf[y * width + (x + 1)];
            val -= blurBuf[(y + 1) * width + x];

            sharpBuf[idx] = Math.max(0, Math.min(255, val));
          }
        }

        // 6. ADAPTIVE THRESHOLDING (Nhị phân thích nghi Bradley-Roth dùng Ảnh Tích Phân)
        // Xây dựng Ảnh tích phân (Integral Image) trong O(N)
        const intImg = new Float64Array(size);
        for (let y = 0; y < height; y++) {
          let sum = 0;
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            sum += sharpBuf[idx];
            if (y === 0) {
              intImg[idx] = sum;
            } else {
              intImg[idx] = intImg[(y - 1) * width + x] + sum;
            }
          }
        }

        // Cửa sổ quét S (Kích thước phụ thuộc bề rộng ảnh) và Ngưỡng sai số T (15%)
        const S = Math.max(8, Math.min(32, Math.round(width / 16)));
        const T = 0.15;
        const halfS = Math.floor(S / 2);

        // Nhị phân hóa thích nghi từng pixel
        const binaryBuf = new Uint8ClampedArray(size);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            const x1 = Math.max(0, x - halfS);
            const x2 = Math.min(width - 1, x + halfS);
            const y1 = Math.max(0, y - halfS);
            const y2 = Math.min(height - 1, y + halfS);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);

            // Tính tổng nhanh O(1) từ Integral Image
            let sum = intImg[y2 * width + x2];
            if (x1 > 0) sum -= intImg[y2 * width + (x1 - 1)];
            if (y1 > 0) sum -= intImg[(y1 - 1) * width + x2];
            if (x1 > 0 && y1 > 0) sum += intImg[(y1 - 1) * width + (x1 - 1)];

            // Thực hiện so sánh Bradley-Roth
            if (sharpBuf[idx] * count < sum * (1.0 - T)) {
              binaryBuf[idx] = 0;   // Điểm tối (Nét chữ)
            } else {
              binaryBuf[idx] = 255; // Điểm sáng (Nền)
            }
          }
        }

        // 7. AUTO-INVERSION: Đảm bảo xuất ra chữ ĐEN trên nền TRẮNG
        let darkPixels = 0;
        let lightPixels = 0;
        for (let i = 0; i < size; i++) {
          if (binaryBuf[i] === 0) darkPixels++;
          else lightPixels++;
        }

        const shouldInvert = darkPixels > lightPixels;

        // Cập nhật lại mảng ImageData để vẽ lên Canvas
        for (let i = 0; i < size; i++) {
          const idx = i * 4;
          let val = binaryBuf[i];
          if (shouldInvert) {
            val = 255 - val;
          }
          data[idx] = data[idx + 1] = data[idx + 2] = val;
          data[idx + 3] = 255; // Độ đục tối đa
        }

        ctx.putImageData(imageData, 0, 0);

        // Xuất ảnh PNG không nén suy hao (lossless) giúp nét vẽ cực kỳ rõ ràng
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Lỗi trong quá trình tiền xử lý ảnh OCR:", err);
        resolve(base64Image); // Fallback: Bị lỗi thì trả về ảnh gốc
      }
    };

    img.onerror = (e) => {
      console.warn("Không thể tải ảnh để tiền xử lý:", e);
      resolve(base64Image); // Fallback: Trả về ảnh gốc
    };
    
    img.src = base64Image;
  });
}
