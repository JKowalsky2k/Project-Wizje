// Add a responsive display copy without regenerating existing preview assets.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Job: Decodable { let source: String; let output: String }
enum RenderError: Error { case image(String), write(String) }
let jobs = try JSONDecoder().decode([Job].self, from: FileHandle.standardInput.readDataToEndOfFile())
for job in jobs {
    try autoreleasepool {
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: job.source) as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw RenderError.image(job.source) }
        let width = 960, height = max(1, Int((Double(image.height) * 960 / Double(image.width)).rounded()))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
              space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
        else { throw RenderError.image(job.source) }
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let rendered = context.makeImage(),
              let output = CGImageDestinationCreateWithURL(URL(fileURLWithPath: job.output) as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
        else { throw RenderError.write(job.output) }
        CGImageDestinationAddImage(output, rendered, [kCGImageDestinationLossyCompressionQuality: 0.94] as CFDictionary)
        guard CGImageDestinationFinalize(output) else { throw RenderError.write(job.output) }
    }
}
