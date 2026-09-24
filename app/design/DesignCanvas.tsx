// app/design/DesignCanvas.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Rect, Circle, Transformer } from "react-konva";
import useImage from "use-image";
import { Type, Square, Circle as CircleIcon, ImagePlus, Trash2, Loader2, Check, Download, ShoppingCart } from "lucide-react";

type ElementBase = { id: string; x: number; y: number; rotation: number };
type TextEl = ElementBase & { type: "text"; text: string; fontSize: number; fill: string };
type ImageEl = ElementBase & { type: "image"; src: string; width: number; height: number };
type ShapeEl = ElementBase & { type: "rect" | "circle"; width: number; height: number; fill: string };
type DesignElement = TextEl | ImageEl | ShapeEl;

const LOGICAL_SIZE = 500;
const PRINT_AREA = { x: 100, y: 85, width: 300, height: 365 };

function clampDrag(this: any, pos: { x: number; y: number }) {
  const node = this;
  const rect = node.getClientRect({ relativeTo: node.getStage() });
  const w = rect.width || 0;
  const h = rect.height || 0;
  const minX = PRINT_AREA.x;
  const minY = PRINT_AREA.y;
  const maxX = Math.max(minX, PRINT_AREA.x + PRINT_AREA.width - w);
  const maxY = Math.max(minY, PRINT_AREA.y + PRINT_AREA.height - h);
  return {
    x: Math.min(Math.max(pos.x, minX), maxX),
    y: Math.min(Math.max(pos.y, minY), maxY),
  };
}

function GarmentBackground({ url }: { url: string }) {
  const [image] = useImage(url, "anonymous");
  return <KonvaImage image={image} width={LOGICAL_SIZE} height={LOGICAL_SIZE} />;
}

function UploadedImage({ el, onSelect, onChange }: any) {
  const [image] = useImage(el.src, "anonymous");
  const shapeRef = useRef<any>(null);
  return (
    <KonvaImage
      ref={shapeRef}
      image={image}
      name={el.id}
      x={el.x} y={el.y} width={el.width} height={el.height} rotation={el.rotation}
      draggable dragBoundFunc={clampDrag}
      onClick={onSelect} onTap={onSelect}
      onDragEnd={(e: any) => onChange({ ...el, x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = shapeRef.current;
        onChange({
          ...el, x: node.x(), y: node.y(), rotation: node.rotation(),
          width: node.width() * node.scaleX(), height: node.height() * node.scaleY(),
        });
        node.scaleX(1); node.scaleY(1);
      }}
    />
  );
}

export default function DesignCanvas({
  garmentImageUrl, productId, productTitle,
}: { garmentImageUrl: string; productId: string; productTitle: string }) {
  const [elements, setElements] = useState<DesignElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [printPreview, setPrintPreview] = useState<string | null>(null);
  const [cartStatus, setCartStatus] = useState<string>("");
  const [scale, setScale] = useState(1);

  const transformerRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const guideRectRef = useRef<any>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const propertiesBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateScale() {
      if (!canvasWrapRef.current) return;
      const w = canvasWrapRef.current.offsetWidth;
      setScale(Math.min(w, LOGICAL_SIZE) / LOGICAL_SIZE);
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const attachTransformer = () => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const selectedNode = selectedId ? stage.findOne(`.${selectedId}`) : null;
    transformerRef.current.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current.getLayer().batchDraw();
  };

  useEffect(() => {
    attachTransformer();
  }, [selectedId, elements]);

  // Click anywhere that isn't the canvas or the properties bar clears the selection.
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideCanvas = canvasWrapRef.current?.contains(target);
      const insidePanel = propertiesBarRef.current?.contains(target);
      if (!insideCanvas && !insidePanel) {
        setSelectedId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    fetch(`/api/load-design?productId=${encodeURIComponent(productId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.designId) {
          setDesignId(data.designId);
          setElements(data.elements);
        }
      });
  }, [productId]);

  const updateElement = (updated: DesignElement) =>
    setElements((els) => els.map((el) => (el.id === updated.id ? updated : el)));

  const addText = () =>
    setElements((els) => [...els, { id: crypto.randomUUID(), type: "text", text: "New Text", x: 170, y: 220, rotation: 0, fontSize: 28, fill: "#EDF2EC" }]);

  const addShape = (type: "rect" | "circle") =>
    setElements((els) => [...els, { id: crypto.randomUUID(), type, x: 170, y: 170, rotation: 0, width: 100, height: 100, fill: "#2FA36B" }]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload-image", { method: "POST", body: formData });
    const { url, error } = await res.json();
    if (url) {
      setElements((els) => [...els, { id: crypto.randomUUID(), type: "image", src: url, x: 170, y: 170, rotation: 0, width: 150, height: 150 }]);
    } else {
      alert("Image upload failed: " + (error ?? "timed out waiting for Shopify to process it"));
    }
    e.target.value = "";
  };

  const deleteSelected = () => {
    setElements((els) => els.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const capturePrintReady = () => {
    if (!stageRef.current || !guideRectRef.current) return;

    // Hide the guide box and selection handles so neither bakes into the exported file.
    guideRectRef.current.visible(false);
    transformerRef.current?.nodes([]);
    transformerRef.current?.getLayer().batchDraw();
    guideRectRef.current.getLayer().batchDraw();

    const dataUrl = stageRef.current.toDataURL({
      x: PRINT_AREA.x * scale,
      y: PRINT_AREA.y * scale,
      width: PRINT_AREA.width * scale,
      height: PRINT_AREA.height * scale,
      pixelRatio: scale > 0 ? 2 / scale : 2,
    });

    // Restore the guide box and whatever was selected.
    guideRectRef.current.visible(true);
    guideRectRef.current.getLayer().batchDraw();
    attachTransformer();

    setPrintPreview(dataUrl);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("");
    setCartStatus("");
    const res = await fetch("/api/save-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designId, productId, elements }),
    });
    const result = await res.json();
    if (result.id) {
      setDesignId(result.id);
      setSaveStatus("Saved");
      capturePrintReady();
    } else {
      setSaveStatus("Failed");
    }
    setSaving(false);
  };

  const handleAddToCart = () => {
    setCartStatus("Design ready — this connects to novaedgeonline checkout once cart integration is wired in.");
  };

  const selectedEl = elements.find((el) => el.id === selectedId) as TextEl | ShapeEl | undefined;

  return (
    <div className="workspace">
      <h1 className="workspace-title">{productTitle}</h1>

      <div className="workspace-grid">
        {/* Tool rail */}
        <div className="workspace-rail tool-rail">
          <button className="tool-btn" onClick={addText}>
            <Type size={18} /> Text
          </button>
          <button className="tool-btn" onClick={() => addShape("rect")}>
            <Square size={18} /> Box
          </button>
          <button className="tool-btn" onClick={() => addShape("circle")}>
            <CircleIcon size={18} /> Circle
          </button>
          <label className="tool-btn" style={{ cursor: "pointer" }}>
            <ImagePlus size={18} /> Upload
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
          {selectedId && (
            <button className="tool-btn danger" onClick={deleteSelected}>
              <Trash2 size={18} /> Delete
            </button>
          )}

          <div className="rail-divider" />

          <button className="tool-btn tool-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
            Save
          </button>
          {saveStatus && <p className="save-status">{saveStatus}</p>}
        </div>

        {/* Canvas + properties */}
        <div className="workspace-canvas">
          <div className="canvas-frame">
            <div className="canvas-inner" ref={canvasWrapRef}>
              <Stage
                width={LOGICAL_SIZE * scale}
                height={LOGICAL_SIZE * scale}
                scaleX={scale}
                scaleY={scale}
                ref={stageRef}
                style={{ borderRadius: "8px", overflow: "hidden", display: "block" }}
                onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
              >
                <Layer>
                  <GarmentBackground url={garmentImageUrl} />

                  {elements.map((el) => {
                    const commonProps = {
                      draggable: true,
                      dragBoundFunc: clampDrag,
                      onClick: () => setSelectedId(el.id),
                      onTap: () => setSelectedId(el.id),
                      onDragEnd: (e: any) => updateElement({ ...el, x: e.target.x(), y: e.target.y() }),
                      name: el.id,
                    };

                    if (el.type === "text") {
                      return (
                        <Text
                          key={el.id}
                          {...commonProps}
                          text={el.text} x={el.x} y={el.y} fontSize={el.fontSize} fill={el.fill} rotation={el.rotation}
                          onTransformEnd={(e: any) => {
                            const node = e.target;
                            updateElement({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), fontSize: Math.round(el.fontSize * node.scaleX()) });
                            node.scaleX(1); node.scaleY(1);
                          }}
                        />
                      );
                    }
                    if (el.type === "image") {
                      return <UploadedImage key={el.id} el={el} onSelect={() => setSelectedId(el.id)} onChange={updateElement} />;
                    }
                    if (el.type === "rect") {
                      return (
                        <Rect
                          key={el.id}
                          {...commonProps}
                          x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill} rotation={el.rotation}
                          onTransformEnd={(e: any) => {
                            const node = e.target;
                            updateElement({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), width: node.width() * node.scaleX(), height: node.height() * node.scaleY() });
                            node.scaleX(1); node.scaleY(1);
                          }}
                        />
                      );
                    }
                    if (el.type === "circle") {
                      return (
                        <Circle
                          key={el.id}
                          {...commonProps}
                          x={el.x} y={el.y} radius={el.width / 2} fill={el.fill} rotation={el.rotation}
                          onTransformEnd={(e: any) => {
                            const node = e.target;
                            updateElement({ ...el, x: node.x(), y: node.y(), rotation: node.rotation(), width: el.width * node.scaleX() });
                            node.scaleX(1); node.scaleY(1);
                          }}
                        />
                      );
                    }
                    return null;
                  })}

                  <Rect
                    ref={guideRectRef}
                    x={PRINT_AREA.x} y={PRINT_AREA.y} width={PRINT_AREA.width} height={PRINT_AREA.height}
                    stroke="#2FA36B" strokeWidth={1.5} dash={[7, 5]}
                    listening={false}
                  />

                  <Transformer
                    ref={transformerRef}
                    anchorStroke="#4FD98C"
                    anchorFill="#08090A"
                    anchorSize={9}
                    anchorCornerRadius={4}
                    borderStroke="#4FD98C"
                    borderDash={[5, 4]}
                    borderStrokeWidth={1.5}
                    rotateAnchorOffset={24}
                    boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
                  />
                </Layer>
              </Stage>
            </div>
          </div>

          {selectedEl && (
  <div className="properties-bar" ref={propertiesBarRef}>
    <div className="field-group">
      <span className="panel-label">Color</span>
      <input
        type="color" className="swatch"
        value={selectedEl.fill ?? "#2FA36B"}
        onChange={(e) => updateElement({ ...selectedEl, fill: e.target.value })}
      />
    </div>
    {selectedEl.type === "text" && (
      <>
        <div className="field-group grow">
          <span className="panel-label">Text</span>
          <input
            type="text" className="field"
            value={selectedEl.text ?? ""}
            onChange={(e) => updateElement({ ...selectedEl, text: e.target.value })}
          />
        </div>
        <div className="field-group">
          <span className="panel-label">Size</span>
          <input
            type="number" className="field" style={{ width: "70px" }}
            value={selectedEl.fontSize ?? 28}
            onChange={(e) => updateElement({ ...selectedEl, fontSize: Number(e.target.value) })}
          />
        </div>
      </>
    )}
  </div>
)}

          {!selectedEl && !printPreview && (
            <p className="empty-hint">Select an element on the shirt to edit its color, text, or size.</p>
          )}

          {printPreview && (
            <div className="print-ready">
              <img src={printPreview} alt="Print-ready design" />
              <div className="print-ready-actions">
                <span className="panel-label" style={{ marginBottom: "0.1rem" }}>Print-ready file</span>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <a href={printPreview} download={`novaedge-design-${designId ?? "draft"}.png`} className="btn-outline">
                    <Download size={15} /> Download
                  </a>
                  <button className="btn-cart" onClick={handleAddToCart} disabled={!designId}>
                    <ShoppingCart size={15} /> Add to Cart
                  </button>
                </div>
                {cartStatus && <p className="cart-status">{cartStatus}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}