import { Download, FileText, History, Plus, RotateCcw, Trash2, Upload, type LucideIcon } from "lucide-react";

import type { ActivityAction } from "@/modules/activityLog";

export const ACTIVITY_ICON: Record<ActivityAction, { icon: LucideIcon; tone: string }> = {
  "competition.created": { icon: Plus, tone: "text-success" },
  "competition.updated": { icon: History, tone: "text-info" },
  "competition.deleted": { icon: Trash2, tone: "text-danger" },
  "competition.restored": { icon: RotateCcw, tone: "text-success" },
  "club.created": { icon: Plus, tone: "text-success" },
  "club.updated": { icon: History, tone: "text-info" },
  "club.deleted": { icon: Trash2, tone: "text-danger" },
  "club.restored": { icon: RotateCcw, tone: "text-success" },
  "stadium.created": { icon: Plus, tone: "text-success" },
  "stadium.updated": { icon: History, tone: "text-info" },
  "stadium.deleted": { icon: Trash2, tone: "text-danger" },
  "stadium.restored": { icon: RotateCcw, tone: "text-success" },
  "staff.created": { icon: Plus, tone: "text-success" },
  "staff.updated": { icon: History, tone: "text-info" },
  "staff.deleted": { icon: Trash2, tone: "text-danger" },
  "staff.restored": { icon: RotateCcw, tone: "text-success" },
  "import.matches": { icon: Upload, tone: "text-info" },
  "export.png": { icon: Download, tone: "text-success" },
  "imt.generated": { icon: FileText, tone: "text-info" },
};
