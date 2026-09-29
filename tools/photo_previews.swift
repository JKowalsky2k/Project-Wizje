// macOS build helper. Creates display-sized copies; never writes to source files.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Job: Decodable { let source: String; let output: String; let detail: String; let metadata: String; let orientation: String }
enum PreviewError: Error { case decode(String), render(String), write(String) }
let jobs = try JSONDecoder().decode([Job].self, from: FileHandle.standardInput.readDataToEndOfFile())
// Portraits keep the existing crop; landscapes retain their full composition.
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

for job in jobs {
    try autoreleasepool {
        let source = URL(fileURLWithPath: job.source)
        let output = URL(fileURLWithPath: job.output)
        guard source.standardizedFileURL != output.standardizedFileURL else { throw PreviewError.write(job.output) }
        guard let input = CGImageSourceCreateWithURL(source as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(input, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 12000,
              ] as CFDictionary) else { throw PreviewError.decode(job.source) }
        let width = 480
        let height = job.orientation == "landscape" ? max(1, Int((480.0 * (image.width > image.height ? Double(image.height) / Double(image.width) : 5.0 / 7.0)).rounded())) : 672
        guard let context = CGContext(data: nil, width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw PreviewError.render(job.source) }
        context.interpolationQuality = .high
        context.setFillColor(CGColor(gray: 0.035, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let scale = max(Double(width) / Double(image.width), Double(height) / Double(image.height))
        let drawWidth = Double(image.width) * scale
        let drawHeight = Double(image.height) * scale
        // Match the gallery's centered object-fit: cover, after EXIF orientation.
        context.draw(image, in: CGRect(x: (Double(width) - drawWidth) / 2,
            y: (Double(height) - drawHeight) / 2, width: drawWidth, height: drawHeight))
        guard let rendered = context.makeImage(),
              let destination = CGImageDestinationCreateWithURL(output as CFURL,
                UTType.jpeg.identifier as CFString, 1, nil) else { throw PreviewError.write(job.output) }
        CGImageDestinationAddImage(destination, rendered,
            [kCGImageDestinationLossyCompressionQuality: 0.90] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw PreviewError.write(job.output) }
        // Large preview keeps the complete, correctly oriented photograph.
        let ratio = min(1.0, 2000.0 / Double(max(image.width, image.height)))
        let detailWidth = max(1, Int((Double(image.width) * ratio).rounded()))
        let detailHeight = max(1, Int((Double(image.height) * ratio).rounded()))
        guard let large = CGContext(data: nil, width: detailWidth, height: detailHeight,
            bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw PreviewError.render(job.source) }
        large.interpolationQuality = .high
        large.setFillColor(CGColor(gray: 0.035, alpha: 1))
        large.fill(CGRect(x: 0, y: 0, width: detailWidth, height: detailHeight))
        large.draw(image, in: CGRect(x: 0, y: 0, width: detailWidth, height: detailHeight))
        let detailURL = URL(fileURLWithPath: job.detail)
        guard source.standardizedFileURL != detailURL.standardizedFileURL,
              let renderedDetail = large.makeImage(),
              let detailDestination = CGImageDestinationCreateWithURL(detailURL as CFURL,
                UTType.jpeg.identifier as CFString, 1, nil) else { throw PreviewError.write(job.detail) }
        CGImageDestinationAddImage(detailDestination, renderedDetail,
            [kCGImageDestinationLossyCompressionQuality: 0.94] as CFDictionary)
        guard CGImageDestinationFinalize(detailDestination) else { throw PreviewError.write(job.detail) }
        let properties = CGImageSourceCopyPropertiesAtIndex(input, 0, nil) as? [CFString: Any] ?? [:]
        var sourceWidth = properties[kCGImagePropertyPixelWidth] as? Int ?? image.width
        var sourceHeight = properties[kCGImagePropertyPixelHeight] as? Int ?? image.height
        let orientation = properties[kCGImagePropertyOrientation] as? Int ?? 1
        if (5...8).contains(orientation) { swap(&sourceWidth, &sourceHeight) }
        let info = ["sourceWidth": sourceWidth, "sourceHeight": sourceHeight,
                    "detailWidth": detailWidth, "detailHeight": detailHeight,
                    "width": width, "height": height]
        try JSONSerialization.data(withJSONObject: info).write(to: URL(fileURLWithPath: job.metadata), options: .atomic)

    }
}
