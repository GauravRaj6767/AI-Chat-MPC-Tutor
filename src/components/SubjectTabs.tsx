import { Calculator, Atom, FlaskConical, BarChart3 } from "lucide-react";
import type { Tab } from "../App";

interface SubjectTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "maths",     label: "Maths",     icon: <Calculator size={15} /> },
  { id: "physics",   label: "Physics",   icon: <Atom size={15} /> },
  { id: "chemistry", label: "Chemistry", icon: <FlaskConical size={15} /> },
  { id: "usage",     label: "Usage",     icon: <BarChart3 size={15} /> },
];

export default function SubjectTabs({ activeTab, onTabChange }: SubjectTabsProps) {
  return (
    <div className="subject-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`subject-tab ${tab.id} ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
