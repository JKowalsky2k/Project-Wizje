// macOS build helper. Creates display-sized copies; never writes to source files.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Job: Decodable { let source: String; let output: String }
enum PreviewError: Error { case decode(String), render(String), write(String) }
let jobs = try JSONDecoder().decode([Job].self, from: FileHandle.standardInput.readDataToEndOfFile())
let width = 480, height = 672 // 240 × 336 CSS pixels at 2× display density.
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
    }
}
