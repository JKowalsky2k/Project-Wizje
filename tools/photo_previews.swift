// macOS build helper. Creates display-sized copies; never writes to source files.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Job: Decodable { let source: String; let output: String; let detail: String; let high: String; let inspection: String; let metadata: String; let orientation: String }
enum PreviewError: Error { case decode(String), render(String), write(String) }
let jobs = try JSONDecoder().decode([Job].self, from: FileHandle.standardInput.readDataToEndOfFile())
// Portraits keep the existing crop; landscapes retain their full composition.
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

// Some supplied landscape exports contain a solid white 3px right edge.
// Remove only a narrow, fully white strip from display copies; never write sources.
func withoutWhiteExportEdge(_ image: CGImage) -> (CGImage, Int) {
    guard image.width > image.height, image.width > 16 else { return (image, 0) }
    let limit = 8
    let stripWidth = limit + 1
    guard let strip = image.cropping(to: CGRect(x: image.width - stripWidth, y: 0, width: stripWidth, height: image.height)),
          let context = CGContext(data: nil, width: stripWidth, height: image.height,
            bitsPerComponent: 8, bytesPerRow: stripWidth * 4, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return (image, 0) }
    context.draw(strip, in: CGRect(x: 0, y: 0, width: stripWidth, height: image.height))
    let pixels = context.data!.assumingMemoryBound(to: UInt8.self)
    var trim = 0
    for offset in 0...limit {
        let x = stripWidth - 1 - offset
        var white = true
        for y in 0..<image.height {
            let index = (y * stripWidth + x) * 4
            if pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250 || pixels[index + 3] < 250 {
                white = false; break
            }
        }
        if !white { break }
        trim += 1
    }
    // A wide white region may be part of the photograph or an intentional border.
    guard trim > 0, trim <= limit,
          let cropped = image.cropping(to: CGRect(x: 0, y: 0, width: image.width - trim, height: image.height)) else { return (image, 0) }
    return (cropped, trim)
}

for job in jobs {
    try autoreleasepool {
        let source = URL(fileURLWithPath: job.source)
        let output = URL(fileURLWithPath: job.output)
        guard source.standardizedFileURL != output.standardizedFileURL else { throw PreviewError.write(job.output) }
        guard let input = CGImageSourceCreateWithURL(source as CFURL, nil),
              let decodedImage = CGImageSourceCreateThumbnailAtIndex(input, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: max(1, max(
                    (CGImageSourceCopyPropertiesAtIndex(input, 0, nil) as? [CFString: Any])?[kCGImagePropertyPixelWidth] as? Int ?? 12000,
                    (CGImageSourceCopyPropertiesAtIndex(input, 0, nil) as? [CFString: Any])?[kCGImagePropertyPixelHeight] as? Int ?? 12000)),
              ] as CFDictionary) else { throw PreviewError.decode(job.source) }
        let (image, trimmedRight) = withoutWhiteExportEdge(decodedImage)
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
        // Retina carousel copy: identical crop, three times the small preview width.
        let highWidth = width * 3
        let highHeight = height * 3
        guard let highContext = CGContext(data: nil, width: highWidth, height: highHeight,
            bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw PreviewError.render(job.source) }
        highContext.interpolationQuality = .high
        highContext.setFillColor(CGColor(gray: 0.035, alpha: 1))
        highContext.fill(CGRect(x: 0, y: 0, width: highWidth, height: highHeight))
        highContext.draw(image, in: CGRect(x: (Double(width) - drawWidth) * 1.5,
            y: (Double(height) - drawHeight) * 1.5, width: drawWidth * 3, height: drawHeight * 3))
        guard let highImage = highContext.makeImage(),
              let highDestination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: job.high) as CFURL,
                UTType.jpeg.identifier as CFString, 1, nil) else { throw PreviewError.write(job.high) }
        CGImageDestinationAddImage(highDestination, highImage,
            [kCGImageDestinationLossyCompressionQuality: 0.94] as CFDictionary)
        guard CGImageDestinationFinalize(highDestination) else { throw PreviewError.write(job.high) }
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
        // Full-resolution sRGB inspection copy, without source EXIF/GPS metadata.
        let inspectURL = URL(fileURLWithPath: job.inspection)
        guard source.standardizedFileURL != inspectURL.standardizedFileURL,
              let inspectContext = CGContext(data: nil, width: image.width, height: image.height,
                bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw PreviewError.render(job.source) }
        inspectContext.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        guard let inspectImage = inspectContext.makeImage(),
              let inspectDestination = CGImageDestinationCreateWithURL(inspectURL as CFURL,
                UTType.jpeg.identifier as CFString, 1, nil) else { throw PreviewError.write(job.inspection) }
        CGImageDestinationAddImage(inspectDestination, inspectImage,
            [kCGImageDestinationLossyCompressionQuality: 1.0] as CFDictionary)
        guard CGImageDestinationFinalize(inspectDestination) else { throw PreviewError.write(job.inspection) }
        let properties = CGImageSourceCopyPropertiesAtIndex(input, 0, nil) as? [CFString: Any] ?? [:]
        var sourceWidth = properties[kCGImagePropertyPixelWidth] as? Int ?? image.width
        var sourceHeight = properties[kCGImagePropertyPixelHeight] as? Int ?? image.height
        let orientation = properties[kCGImagePropertyOrientation] as? Int ?? 1
        if (5...8).contains(orientation) { swap(&sourceWidth, &sourceHeight) }
        sourceWidth -= trimmedRight
        let info = ["trimmedRight": trimmedRight, "sourceWidth": sourceWidth, "sourceHeight": sourceHeight,
                    "detailWidth": detailWidth, "detailHeight": detailHeight,
                    "width": width, "height": height]
        try JSONSerialization.data(withJSONObject: info).write(to: URL(fileURLWithPath: job.metadata), options: .atomic)

    }
}
