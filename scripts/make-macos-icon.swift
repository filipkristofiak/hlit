// Run from any directory: swift scripts/make-macos-icon.swift
// Electron's app.dock.setIcon receives a PNG, not an Xcode icon asset catalog:
// bake the rounded silhouette into its alpha channel for unbundled launches.
import CoreGraphics
import ImageIO
import Foundation
import UniformTypeIdentifiers

let assets = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    .deletingLastPathComponent().appendingPathComponent("assets")
let sourceURL = assets.appendingPathComponent("hlit_logo.png")
let outputURL = assets.appendingPathComponent("hlit_icon.png")
guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let logo = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fatalError("Cannot load \(sourceURL.path)")
}

let size = 1024
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
let shape = CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil)
guard let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                              bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("Cannot create icon bitmap")
}
context.setAllowsAntialiasing(true)
context.setShouldAntialias(true)

// The plate is inset like other macOS Dock icons. Its shadow stays on the
// transparent canvas; clipping only the artwork keeps the corners clean.
context.saveGState()
context.setShadow(offset: CGSize(width: 0, height: -9), blur: 18,
                  color: CGColor(gray: 0, alpha: 0.28))
context.addPath(shape)
context.setFillColor(CGColor(gray: 1, alpha: 1))
context.fillPath()
context.restoreGState()
context.addPath(shape)
context.clip()
context.draw(logo, in: tile)

guard let image = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL,
                                                        UTType.png.identifier as CFString, 1, nil) else {
    fatalError("Cannot create \(outputURL.path)")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
    fatalError("Cannot write \(outputURL.path)")
}
print(outputURL.path)
