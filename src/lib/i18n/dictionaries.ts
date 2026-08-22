export const LOCALES = ["mr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "mr";

export const LOCALE_LABELS: Record<Locale, string> = {
  mr: "मराठी",
  en: "English",
};

const en = {
  // Auth
  "auth.signIn": "Volunteer sign in",
  "auth.subtitle": "Accounts are created by the mandal treasurer.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.submit": "Sign in",
  "auth.submitting": "Signing in…",
  "auth.logout": "Logout",
  "auth.bookName": "Pavti Pustak",

  // Dashboard shell
  "nav.overview": "Overview",
  "nav.receipts": "Receipts",
  "nav.activity": "Activity",
  "nav.report": "Print report",
  "nav.menu": "Menu",
  "realtime.live": "Live — synced across devices",
  "realtime.off": "Offline — pull to refresh",

  // Activity log
  "activity.title": "Activity log",
  "activity.subtitle": "Every change to the ledger, newest first.",
  "activity.empty": "No changes recorded yet.",
  "activity.created": "created",
  "activity.updated": "edited",
  "activity.deleted": "deleted",
  "activity.receiptNo": "Receipt #{number}",
  "activity.changed": "{field}: {from} → {to}",
  "activity.by": "by {who}",
  "activity.filterAll": "All",
  "activity.filterCreated": "Created",
  "activity.filterEdits": "Edited",
  "activity.filterDeletes": "Deleted",
  "activity.allVolunteers": "All volunteers",
  "activity.dayCount": "{count} changes",
  "activity.noneInPeriod": "No changes in this period.",

  // Stats
  "stats.total": "Total collected",
  "stats.receipts": "Receipts",
  "stats.donors": "Donors",
  "stats.today": "Today",
  "stats.avgReceipt": "Average donation",

  // Period filter
  "period.today": "Today",
  "period.7": "Last 7 days",
  "period.30": "Last 30 days",
  "period.all": "All time",
  "period.empty": "No donations in this period.",

  // Table
  "table.title": "Vargani",
  "table.subtitle": "All donations collected by the mandal, newest first.",
  "table.search": "Search name, mobile or receipt no.",
  "table.export": "Export",
  "export.excel": "Excel (.xlsx)",
  "export.pdf": "PDF / Print",
  "export.csv": "CSV",
  "table.new": "New receipt",
  "table.no": "No.",
  "table.donor": "Donor",
  "table.amount": "Amount",
  "table.mobile": "Mobile",
  "table.method": "Method",
  "table.date": "Date",
  "table.actions": "Actions",
  "table.send": "Send",
  "table.edit": "Edit",
  "table.delete": "Delete",
  "table.empty": "No receipts yet. Add your first vargani entry.",
  "table.noMatch": "No receipts match that search.",
  "table.showing": "Showing {shown} of {total} receipts.",
  "table.sendTitle": "Send receipt to {name} on WhatsApp",

  // Form
  "form.newTitle": "New receipt",
  "form.editTitle": "Edit receipt",
  "form.newSubtitle": "Record a vargani donation. Past dates are allowed.",
  "form.editSubtitle": "Receipt #{number}",
  "form.donorName": "Donor name",
  "form.donorPlaceholder": "Sunil Patil",
  "form.amount": "Amount (₹)",
  "form.mobile": "Mobile",
  "form.method": "Payment method",
  "form.date": "Collection date",
  "form.pickDate": "Pick a date",
  "form.cancel": "Cancel",
  "form.save": "Save receipt",
  "form.saveChanges": "Save changes",
  "method.Cash": "Cash",
  "method.UPI": "UPI",

  // Delete
  "delete.title": "Delete this receipt?",
  "delete.body":
    "Receipt #{number} for {name} ({amount}) will be removed permanently. This cannot be undone.",
  "delete.confirm": "Delete",
  "delete.deleting": "Deleting…",

  // Toasts
  "toast.saved": "Receipt saved.",
  "toast.updated": "Receipt updated.",
  "toast.deleted": "Receipt #{number} deleted.",
  "toast.exported": "Exported {count} receipt(s).",
  "toast.nothingToExport": "Nothing to export.",

  // Chart
  "chart.title": "Collection by date",
  "chart.subtitle": "Daily vargani totals, split by payment method.",
  "chart.empty": "No collections to chart yet.",
  "chart.showTable": "Show table",
  "chart.showChart": "Show chart",
  "chart.receiptsCount": "{count} receipts",
  "report.title": "Vargani Collection Report",
  "report.generated": "Generated on",
  "report.period": "Period",
  "report.grandTotal": "Grand total",
  "report.print": "Print / Save as PDF",
  "report.back": "Back to dashboard",
  "chart.busiestDay": "Busiest day",
  "chart.dailyAverage": "Daily average",
} as const;

export type MessageKey = keyof typeof en;

const mr: Record<MessageKey, string> = {
  "auth.signIn": "स्वयंसेवक प्रवेश",
  "auth.subtitle": "खाती मंडळाच्या खजिनदाराकडून तयार केली जातात.",
  "auth.email": "ईमेल",
  "auth.password": "पासवर्ड",
  "auth.submit": "प्रवेश करा",
  "auth.submitting": "प्रवेश करत आहे…",
  "auth.logout": "बाहेर पडा",
  "auth.bookName": "पावती पुस्तक",

  "nav.overview": "आढावा",
  "nav.receipts": "पावत्या",
  "nav.activity": "बदल इतिहास",
  "nav.report": "अहवाल छापा",
  "nav.menu": "मेनू",
  "realtime.live": "थेट — सर्व उपकरणांवर अद्ययावत",
  "realtime.off": "ऑफलाइन — रिफ्रेश करा",

  "activity.title": "बदल इतिहास",
  "activity.subtitle": "नोंदवहीतील प्रत्येक बदल, नवीन प्रथम.",
  "activity.empty": "अजून कोणताही बदल नाही.",
  "activity.created": "नोंदवली",
  "activity.updated": "बदलली",
  "activity.deleted": "काढली",
  "activity.receiptNo": "पावती क्र. {number}",
  "activity.changed": "{field}: {from} → {to}",
  "activity.by": "{who} यांनी",
  "activity.filterAll": "सर्व",
  "activity.filterCreated": "नोंदवलेल्या",
  "activity.filterEdits": "बदललेल्या",
  "activity.filterDeletes": "काढलेल्या",
  "activity.allVolunteers": "सर्व स्वयंसेवक",
  "activity.dayCount": "{count} बदल",
  "activity.noneInPeriod": "या कालावधीत बदल नाही.",

  "stats.total": "एकूण जमा",
  "stats.receipts": "पावत्या",
  "stats.donors": "देणगीदार",
  "stats.today": "आज",
  "stats.avgReceipt": "सरासरी देणगी",

  "period.today": "आज",
  "period.7": "शेवटचे ७ दिवस",
  "period.30": "शेवटचे ३० दिवस",
  "period.all": "संपूर्ण कालावधी",
  "period.empty": "या कालावधीत देणगी नाही.",

  "table.title": "वर्गणी",
  "table.subtitle": "मंडळाने जमा केलेल्या सर्व देणग्या, नवीन प्रथम.",
  "table.search": "नाव, मोबाईल किंवा पावती क्रमांक शोधा",
  "table.export": "निर्यात",
  "export.excel": "एक्सेल (.xlsx)",
  "export.pdf": "पीडीएफ / छपाई",
  "export.csv": "CSV",
  "table.new": "नवीन पावती",
  "table.no": "क्र.",
  "table.donor": "देणगीदार",
  "table.amount": "रक्कम",
  "table.mobile": "मोबाईल",
  "table.method": "माध्यम",
  "table.date": "दिनांक",
  "table.actions": "क्रिया",
  "table.send": "पाठवा",
  "table.edit": "बदल",
  "table.delete": "काढा",
  "table.empty": "अजून पावत्या नाहीत. पहिली वर्गणी नोंदवा.",
  "table.noMatch": "शोधाशी जुळणारी पावती नाही.",
  "table.showing": "{total} पैकी {shown} पावत्या दिसत आहेत.",
  "table.sendTitle": "{name} यांना WhatsApp वर पावती पाठवा",

  "form.newTitle": "नवीन पावती",
  "form.editTitle": "पावती बदला",
  "form.newSubtitle": "वर्गणी नोंदवा. मागील दिनांक चालतो.",
  "form.editSubtitle": "पावती क्र. {number}",
  "form.donorName": "देणगीदाराचे नाव",
  "form.donorPlaceholder": "सुनील पाटील",
  "form.amount": "रक्कम (₹)",
  "form.mobile": "मोबाईल",
  "form.method": "देय माध्यम",
  "form.date": "जमा दिनांक",
  "form.pickDate": "दिनांक निवडा",
  "form.cancel": "रद्द",
  "form.save": "पावती जतन करा",
  "form.saveChanges": "बदल जतन करा",
  "method.Cash": "रोख",
  "method.UPI": "UPI",

  "delete.title": "ही पावती काढून टाकायची?",
  "delete.body":
    "{name} यांची पावती क्र. {number} ({amount}) कायमची काढून टाकली जाईल. हे पूर्ववत होणार नाही.",
  "delete.confirm": "काढून टाका",
  "delete.deleting": "काढत आहे…",

  "toast.saved": "पावती जतन झाली.",
  "toast.updated": "पावती बदलली.",
  "toast.deleted": "पावती क्र. {number} काढली.",
  "toast.exported": "{count} पावत्या निर्यात केल्या.",
  "toast.nothingToExport": "निर्यात करण्यासाठी काही नाही.",

  "chart.title": "दिनांकानुसार जमा",
  "chart.subtitle": "दैनिक वर्गणी, देय माध्यमानुसार विभागणी.",
  "chart.empty": "आलेखासाठी अजून जमा नाही.",
  "chart.showTable": "तक्ता दाखवा",
  "chart.showChart": "आलेख दाखवा",
  "chart.receiptsCount": "{count} पावत्या",
  "report.title": "वर्गणी जमा अहवाल",
  "report.generated": "तयार दिनांक",
  "report.period": "कालावधी",
  "report.grandTotal": "एकूण रक्कम",
  "report.print": "छपाई / PDF म्हणून जतन करा",
  "report.back": "डॅशबोर्डवर परत",
  "chart.busiestDay": "सर्वाधिक जमा",
  "chart.dailyAverage": "दैनिक सरासरी",
};

export const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  mr,
};

export type Dictionary = Record<MessageKey, string>;

/** Replaces `{name}`-style placeholders. */
export function interpolate(
  template: string,
  values?: Record<string, string | number>,
) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
