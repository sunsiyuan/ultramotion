// Faces and animals in each frame (Apple Vision, macOS): swift detect.swift <frame dir>  → stdout JSON {file: [[x, y, w, h, kind], …]} (0–1, top-left origin)
import Foundation
import Vision
import AppKit
let dir = URL(fileURLWithPath: CommandLine.arguments[1])
let files = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".jpg") }.sorted()
var out: [String: [[Any]]] = [:]
for f in files {
    guard let img = NSImage(contentsOf: dir.appendingPathComponent(f)), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let faces = VNDetectFaceRectanglesRequest(), animals = VNRecognizeAnimalsRequest(), pose = VNDetectAnimalBodyPoseRequest()
    try? VNImageRequestHandler(cgImage: cg).perform([faces, animals, pose])
    var boxes: [[Any]] = []
    let add = { (b: CGRect, k: String) in boxes.append([b.minX, 1 - b.maxY, b.width, b.height, k]) }
    for r in faces.results ?? [] { add(r.boundingBox, "face") }
    for r in animals.results ?? [] { add(r.boundingBox, r.labels.first?.identifier ?? "animal") }
    for r in pose.results ?? [] {                       // animal head from its ear / eye / nose points
        let pts = ((try? r.recognizedPoints(.head)) ?? [:]).values.filter { $0.confidence > 0.3 }
        if pts.count >= 3 {
            let xs = pts.map { $0.location.x }, ys = pts.map { $0.location.y }
            let w = xs.max()! - xs.min()!, h = ys.max()! - ys.min()!, pad = max(w, h) * 0.06   // points run ear tip → nose; add the chin below
            add(CGRect(x: xs.min()! - pad, y: ys.min()! - h * 0.45, width: w + pad * 2, height: h * 1.45 + pad), "animal-head")
        }
    }
    out[f] = boxes
}
let data = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
