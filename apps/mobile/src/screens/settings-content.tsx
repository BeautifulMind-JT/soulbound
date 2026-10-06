import Constants from "expo-constants";
import React, { useState } from "react";
import { Alert, Text } from "react-native";
import { useAuth } from "../auth/auth-provider";
import { appConfig, termsUrl } from "../config";
import { useBlocks } from "../lib/block-store";
import { openExternal } from "../lib/links";
import { Badge, Body, Button, Card, ListRow, Message, SectionTitle, styles } from "../ui/components";

export function SettingsContent() {
  const { signOut } = useAuth();
  const { blocked, toggle } = useBlocks();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
    } catch {
      setSignOutError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSigningOut(false);
    }
  }

  function confirmDeletion() {
    Alert.alert(
      "계정 삭제",
      "계정 삭제를 요청하면 멤버십과 계정 정보가 삭제되며 되돌릴 수 없습니다. 삭제 요청 페이지로 이동할까요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제 요청",
          style: "destructive",
          onPress: () => void openExternal(
            appConfig.accountDeletionUrl,
            "계정 삭제 요청 경로가 아직 설정되지 않았습니다.",
          ),
        },
      ],
    );
  }

  return (
    <>
      <Card>
        <SectionTitle>내 계정</SectionTitle>
        <ListRow title="로그아웃" description="이 기기에서 나갑니다." />
        <Message text={signOutError} />
        <Button
          label={signingOut ? "로그아웃 중" : "로그아웃"}
          tone="secondary"
          onPress={() => void handleSignOut()}
          disabled={signingOut}
        />
      </Card>

      <Card>
        <SectionTitle>개인정보·약관</SectionTitle>
        <ListRow
          title="개인정보 처리방침"
          description="개인정보와 보관 기준 확인"
          onPress={() => void openExternal(appConfig.privacyPolicyUrl, "개인정보 처리방침 주소가 아직 준비되지 않았습니다.")}
        />
        <ListRow
          title="이용약관"
          description="SoulBound 이용약관"
          onPress={() => void openExternal(termsUrl(), "약관 주소가 설정되지 않았습니다.")}
        />
      </Card>

      <Card>
        <SectionTitle>차단한 멤버</SectionTitle>
        <Body muted>차단은 이 기기에만 저장되며, 차단한 멤버의 글과 댓글을 숨깁니다.</Body>
        {blocked.length === 0 ? <Body muted>차단한 멤버가 없습니다.</Body> : null}
        {blocked.map((memberNumber) => (
          <ListRow
            key={memberNumber}
            title={`soulbound-member-${memberNumber}`}
            trailing={<Button label="차단 해제" tone="quiet" onPress={() => toggle(memberNumber)} />}
          />
        ))}
      </Card>

      <Card>
        <SectionTitle>계정 삭제</SectionTitle>
        <Body muted>계정과 멤버십 삭제를 요청합니다. 요청 후에는 되돌릴 수 없습니다.</Body>
        <Button label="계정 삭제" tone="danger" onPress={confirmDeletion} />
      </Card>

      <Card>
        <ListRow
          title="앱 정보 / 버전"
          description={`SoulBound ${Constants.expoConfig?.version ?? ""}`}
          trailing={<Badge label="프리알파" />}
        />
        <Text style={styles.muted}>Persona Clip 녹화와 알림은 iPhone 앱에서 제공하지 않습니다.</Text>
      </Card>
    </>
  );
}
