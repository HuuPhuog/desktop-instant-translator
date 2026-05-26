/**
 * ============================================
 * 📁 src/services/columnSegmenter.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Phân tách các cột văn bản từ kết quả OCR có tọa độ hình học.
 * Hỗ trợ nhận diện "spanning lines" (dòng rộng như tiêu đề, đoạn văn đọc hiểu)
 * và tách riêng khỏi các "column lines" (câu hỏi, đáp án theo cột dọc).
 *
 * VẤN ĐỀ CŨ:
 * Dòng passage rộng (80-100% chiều rộng trang) có X-range bao phủ toàn trang,
 * khiến thuật toán phân cột cũ gom hết các câu hỏi/đáp án phía dưới vào 1 cột.
 *
 * GIẢI PHÁP:
 * - Tính chiều rộng trang thực tế từ tất cả bboxes.
 * - Dòng nào rộng hơn SPANNING_THRESHOLD (65% trang) → SpanningLine, xử lý riêng.
 * - Chỉ các dòng hẹp mới được phân cụm vào cột dọc.
 * - Sắp xếp các vùng theo thứ tự đọc tự nhiên: trên→dưới, trái→phải.
 * ============================================
 */

import type { OCRLineBox, OCRRegionBox } from "../types";

/** Dòng tạm thời từ Tesseract (trước khi phân cột) */
export interface RawLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  x0: number;
  x1: number;
}

/**
 * segmentColumns - Phân tách các cột văn bản từ danh sách dòng OCR.
 *
 * @param lines - Danh sách dòng thô từ Tesseract (có bbox)
 * @returns Danh sách các vùng OCR đã được sắp xếp theo thứ tự đọc
 */
export function segmentColumns(lines: RawLine[]): OCRRegionBox[] {
  if (lines.length === 0) return [];

  // 1. Tính toán chiều rộng trang từ tất cả bboxes
  const allX0 = lines.map((l) => l.x0);
  const allX1 = lines.map((l) => l.x1);
  const minPageX = Math.min(...allX0);
  const maxPageX = Math.max(...allX1);
  const pageWidth = Math.max(1, maxPageX - minPageX);

  // Ngưỡng spanning: dòng rộng hơn 65% trang là spanning line
  const SPANNING_THRESHOLD = pageWidth * 0.65;

  const spanningLines: RawLine[] = [];
  const columnLines: RawLine[] = [];

  for (const line of lines) {
    if (line.width > SPANNING_THRESHOLD) {
      spanningLines.push(line);
    } else {
      columnLines.push(line);
    }
  }

  // 2. Phân cụm columnLines vào các cột dọc độc lập
  const columns: { minX: number; maxX: number }[] = [];

  for (const line of columnLines) {
    let matchedColIdx = -1;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const overlap = Math.max(0, Math.min(line.x1, col.maxX) - Math.max(line.x0, col.minX));
      const lineCenter = (line.x0 + line.x1) / 2;
      const minColW = Math.min(line.width, col.maxX - col.minX);

      // Overlap đáng kể (>30% độ rộng nhỏ hơn) hoặc tâm dòng nằm trong cột
      if (overlap > 0.3 * minColW || (lineCenter >= col.minX && lineCenter <= col.maxX)) {
        matchedColIdx = i;
        break;
      }
    }

    if (matchedColIdx !== -1) {
      columns[matchedColIdx].minX = Math.min(columns[matchedColIdx].minX, line.x0);
      columns[matchedColIdx].maxX = Math.max(columns[matchedColIdx].maxX, line.x1);
    } else {
      columns.push({ minX: line.x0, maxX: line.x1 });
    }
  }

  // Sắp xếp cột từ trái qua phải
  columns.sort((a, b) => a.minX - b.minX);

  // Tạo OCRRegionBox cho mỗi cột
  const colRegions: OCRRegionBox[] = columns.map((col, idx) => ({
    regionIndex: idx,
    text: "",
    x: col.minX,
    y: 0,
    width: col.maxX - col.minX,
    height: 0,
    lines: [],
  }));

  // Gán từng dòng hẹp vào cột phù hợp nhất (max overlap)
  for (const line of columnLines) {
    let bestColIdx = 0;
    let maxOverlap = -1;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const overlap = Math.max(0, Math.min(line.x1, col.maxX) - Math.max(line.x0, col.minX));
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestColIdx = i;
      }
    }

    const lineBox: OCRLineBox = {
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      confidence: line.confidence,
      words: line.words.map((w) => ({
        text: w.text,
        x: w.bbox.x,
        y: w.bbox.y,
        width: w.bbox.width,
        height: w.bbox.height,
        confidence: w.confidence,
      })),
      lineIndex: 0,
      regionIndex: bestColIdx,
    };

    colRegions[bestColIdx].lines.push(lineBox);
  }

  // Lọc bỏ cột rỗng
  const activeColRegions = colRegions.filter((r) => r.lines.length > 0);

  // 3. Spanning lines → mỗi cái là 1 vùng độc lập (giữ đúng vị trí Y)
  const spanningRegions: OCRRegionBox[] = spanningLines.map((line, idx) => {
    const lineBox: OCRLineBox = {
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      confidence: line.confidence,
      words: line.words.map((w) => ({
        text: w.text,
        x: w.bbox.x,
        y: w.bbox.y,
        width: w.bbox.width,
        height: w.bbox.height,
        confidence: w.confidence,
      })),
      lineIndex: 0,
      regionIndex: 1000 + idx,
    };

    return {
      regionIndex: 1000 + idx,
      text: line.text,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      lines: [lineBox],
    };
  });

  // 4. Gộp tất cả vùng và sắp xếp theo thứ tự đọc tự nhiên
  const allRegions = [...activeColRegions, ...spanningRegions];

  allRegions.sort((a, b) => {
    const aMinY = a.lines.length > 0 ? Math.min(...a.lines.map((l) => l.y)) : a.y;
    const bMinY = b.lines.length > 0 ? Math.min(...b.lines.map((l) => l.y)) : b.y;

    // Lệch dọc đáng kể (>40px) → vùng trên đọc trước
    if (Math.abs(aMinY - bMinY) > 40) return aMinY - bMinY;
    // Nằm ngang hàng nhau → vùng bên trái đọc trước
    return a.x - b.x;
  });

  // 5. Đánh lại index và cập nhật thông số hình học
  allRegions.forEach((region, rIdx) => {
    region.regionIndex = rIdx;
    region.lines.sort((a, b) => a.y - b.y);
    region.lines.forEach((line, lIdx) => {
      line.lineIndex = lIdx;
      line.regionIndex = rIdx;
    });
    if (region.lines.length > 0) {
      const minY = Math.min(...region.lines.map((l) => l.y));
      const maxY = Math.max(...region.lines.map((l) => l.y + l.height));
      region.y = minY;
      region.height = maxY - minY;
    }
    region.text = region.lines.map((l) => l.text.trim()).join("\n");
  });

  return allRegions;
}
