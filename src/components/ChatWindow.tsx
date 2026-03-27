import { useEffect, useRef } from "react";
import type { Message, Subject } from "../App";
import MessageBubble from "./MessageBubble";

interface ChatWindowProps {
  messages: Message[];
  subject: Subject;
  loading: boolean;
}

const exampleQuestions: Record<Subject, string[]> = {
  maths: [
    "Find the integral of x² · eˣ dx",
    "Solve: lim (x→0) sin(5x) / 3x",
    "Find the area enclosed between y = x² and y = 2x",
  ],
  physics: [
    "Derive the time period expression for a simple pendulum",
    "A ball is thrown at 30 m/s at 60°. Find max height and range.",
    "Explain the working of a cyclotron with full derivation",
  ],
  chemistry: [
    "Explain SN1 and SN2 mechanisms with examples",
    "Balance: KMnO₄ + HCl → KCl + MnCl₂ + H₂O + Cl₂",
    "Derive the Nernst equation and explain its applications",
  ],
};

const subjectConfig: Record<Subject, { label: string; emoji: string; hint: string }> = {
  maths:     { label: "Mathematics", emoji: "∑", hint: "Calculus, Algebra, Coordinate Geometry, Vectors & more" },
  physics:   { label: "Physics",     emoji: "⚛", hint: "Mechanics, Electrodynamics, Optics, Modern Physics & more" },
  chemistry: { label: "Chemistry",   emoji: "⚗", hint: "Organic, Inorganic, Physical Chemistry & more" },
};

export default function ChatWindow({ messages, subject, loading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const cfg = subjectConfig[subject];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          <div className={`empty-icon ${subject}`}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.5rem" }}>
              {cfg.emoji}
            </span>
          </div>
          <h2>Ask anything in {cfg.label}</h2>
          <p>
            Step-by-step JEE solutions powered by Gemini 2.5 Pro.<br />
            {cfg.hint}
          </p>
          <div className="example-questions">
            {exampleQuestions[subject].map((q, i) => (
              <button
                key={i}
                className="example-question"
                onClick={() => {
                  const ta = document.querySelector<HTMLTextAreaElement>(".input-textarea");
                  if (ta) {
                    const setter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype, "value"
                    )?.set;
                    setter?.call(ta, q);
                    ta.dispatchEvent(new Event("input", { bubbles: true }));
                    ta.focus();
                  }
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && (
        <div className="message ai">
          <div className="message-bubble">
            <div className="loading-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
