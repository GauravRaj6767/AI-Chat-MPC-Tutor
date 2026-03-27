import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Paperclip, Send, X } from "lucide-react";
import type { Subject } from "../App";

interface InputBarProps {
  onSend: (text: string, imageBase64?: string, imageMimeType?: string) => void;
  loading: boolean;
  subject: Subject;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function InputBar({ onSend, loading }: InputBarProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, []);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert("Please select a JPG, PNG, or WebP image.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("Image must be under 10 MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        setImage({
          base64,
          mimeType: file.type,
          previewUrl: dataUrl,
        });
      };
      reader.readAsDataURL(file);

      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [],
  );

  const removeImage = useCallback(() => {
    setImage(null);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !image) return;
    if (loading) return;

    onSend(
      trimmed || "(See attached image)",
      image?.base64,
      image?.mimeType,
    );
    setText("");
    setImage(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, image, loading, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = (text.trim().length > 0 || image !== null) && !loading;

  return (
    <div className="input-bar">
      <div className="input-outer">
        {image && (
          <div className="image-preview-container">
            <div className="image-preview">
              <img src={image.previewUrl} alt="Preview" />
              <button className="image-preview-remove" onClick={removeImage} type="button">
                <X size={9} />
              </button>
            </div>
          </div>
        )}
        <div className="input-row">
          <button
            className="input-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image (JPG, PNG, WebP)"
            type="button"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />
          <textarea
            ref={textareaRef}
            className="input-textarea"
            placeholder="Ask any JEE question…"
            value={text}
            onChange={(e) => { setText(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className="input-btn send"
            onClick={handleSend}
            disabled={!canSend}
            title="Send"
            type="button"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <div className="file-hint">JPG · PNG · WebP &nbsp;|&nbsp; Shift+Enter for newline</div>
    </div>
  );
}
