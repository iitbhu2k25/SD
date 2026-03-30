"use client";

import UserDataInit from "./UserDataInit";
import UserLeftPanel from "./UserLeftPanel";
import UserMainView from "./UserMainView";
import ScreenLayout from "../../shared/ui/ScreenLayout";

export default function UserScreen() {
  return (
    <UserDataInit>
      <ScreenLayout leftPanel={<UserLeftPanel />} mainContent={<UserMainView />} />
    </UserDataInit>
  );
}
