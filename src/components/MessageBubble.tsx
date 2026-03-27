import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../App";

interface MessageBubbleProps {
  message: Message;
}

function formatCost(usd: number): string {
  if (usd < 0.00001) return "<$0.00001";
  if (usd < 0.001)   return `$${usd.toFixed(5)}`;
  if (usd < 0.01)    return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`message ${isUser ? "user" : "ai"}`}>
      <div className="message-bubble">
        {isUser && message.imageBase64 && (
          <img
            className="message-image"
            src={`data:${message.imageMimeType ?? "image/png"};base64,${message.imageBase64}`}
            alt="Uploaded"
          />
        )}
        {isUser ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{message.text}</div>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
            >
              {message.text}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {!isUser && message.tokenInfo && (
        <div className="message-meta">
          <span className="meta-pill">
            🔢 {formatTokens(message.tokenInfo.inputTokens)} in
          </span>
          <span className="meta-pill">
            ✨ {formatTokens(message.tokenInfo.outputTokens)} out
          </span>
          <span className="meta-pill">
            💰 {formatCost(message.tokenInfo.costUsd)}
          </span>
        </div>
      )}
    </div>
  );
}
