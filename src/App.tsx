import { useState, useCallback, useEffect } from "react";
import SubjectTabs from "./components/SubjectTabs";
import ChatWindow from "./components/ChatWindow";
import InputBar from "./components/InputBar";
import UsageDashboard, { type UsageData } from "./components/UsageDashboard";
import { Sun, Moon } from "lucide-react";

export type Subject = "maths" | "physics" | "chemistry";
export type Tab = Subject | "usage";

export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
  tokenInfo?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("maths");
  const [messages, setMessages] = useState<Record<Subject, Message[]>>({
    maths: [],
    physics: [],
    chemistry: [],
  });
  const [loading, setLoading] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageLastRefresh, setUsageLastRefresh] = useState(new Date());
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  // Fetch usage once on mount — does NOT re-run on tab switches
  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsageData(data);
      setUsageLastRefresh(new Date());
    } catch (err) {
      console.error("[App] Failed to fetch usage:", err);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentSubject: Subject =
    activeTab === "usage" ? "maths" : activeTab;

  const handleSend = useCallback(
    async (text: string, imageBase64?: string, imageMimeType?: string) => {
      const subject = currentSubject;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        text,
        imageBase64,
        imageMimeType,
      };

      setMessages((prev) => ({
        ...prev,
        [subject]: [...prev[subject], userMessage],
      }));

      setLoading(true);

      try {
        // Send only the last 2 exchanges (4 messages) as context.
        // Full history stays visible in the UI — only what Gemini sees is trimmed.
        const CONTEXT_WINDOW = 4;
        const history = messages[subject]
          .slice(-CONTEXT_WINDOW)
          .map((m) => ({ role: m.role, text: m.text }));

        const body: Record<string, unknown> = { subject, question: text, history };
        if (imageBase64 && imageMimeType) {
          body.imageBase64 = imageBase64;
          body.imageMimeType = imageMimeType;
        }

        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `Request failed (${res.status})`,
          );
        }

        const data = await res.json();

        const aiMessage: Message = {
          id: generateId(),
          role: "ai",
          text: data.answer,
          tokenInfo: data.usage
            ? {
                inputTokens: data.usage.inputTokens,
                outputTokens: data.usage.outputTokens,
                totalTokens: data.usage.totalTokens,
                costUsd: data.usage.totalCostUsd,
              }
            : undefined,
        };

        setMessages((prev) => ({
          ...prev,
          [subject]: [...prev[subject], aiMessage],
        }));

        // Fire-and-forget: log usage to DB via dedicated endpoint
        // Runs completely in background — any failure here never affects the UI
        if (data.usage) {
          fetch("/api/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data.usage),
          }).catch(() => {
            // Silent — DB logging failure must never surface to user
          });
        }
      } catch (err) {
        const errorMessage: Message = {
          id: generateId(),
          role: "ai",
          text: `**Error:** ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
        };
        setMessages((prev) => ({
          ...prev,
          [subject]: [...prev[subject], errorMessage],
        }));
      } finally {
        setLoading(false);
      }
    },
    [currentSubject],
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🎯</div>
          <span className="app-logo-text">JEE Tutor</span>
        </div>
        <div className="header-right">
          <SubjectTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {activeTab === "usage" ? (
        <UsageDashboard
          data={usageData}
          loading={usageLoading}
          lastRefresh={usageLastRefresh}
          onRefresh={fetchUsage}
        />
      ) : (
        <>
          <ChatWindow
            messages={messages[activeTab]}
            subject={activeTab}
            loading={loading}
          />
          <InputBar onSend={handleSend} loading={loading} subject={activeTab} />
        </>
      )}
    </div>
  );
}
