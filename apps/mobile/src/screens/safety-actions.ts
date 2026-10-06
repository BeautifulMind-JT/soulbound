import { Alert } from "react-native";
import { appConfig } from "../config";
import { openExternal } from "../lib/links";
import { buildReportLink, type ReportTarget } from "../lib/safety";

export function reportContent(target: ReportTarget): void {
  void openExternal(
    buildReportLink(appConfig.reportUrl, target) ?? "",
    "신고 접수 경로가 아직 설정되지 않았습니다.",
  );
}

export function openSafetyMenu(options: {
  readonly target: ReportTarget;
  readonly memberNumber: number;
  readonly memberLabel: string;
  readonly blocked: boolean;
  readonly onToggleBlock: () => void;
}): void {
  Alert.alert(options.memberLabel, undefined, [
    { text: "신고하기", onPress: () => reportContent(options.target) },
    {
      text: options.blocked ? "차단 해제" : "차단하기 (이 기기에서 숨김)",
      style: options.blocked ? "default" : "destructive",
      onPress: options.onToggleBlock,
    },
    { text: "취소", style: "cancel" },
  ]);
}
