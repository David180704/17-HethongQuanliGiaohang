import { StyleSheet, View } from "react-native";
import Screen from "../components/Screen";
import Button from "../components/Button";
import Banner from "../components/Banner";
import ProfileCard, { SectionTitle } from "../components/ProfileCard";
import FeatureTile, { TileGrid } from "../components/FeatureTile";

// Khung trang chu dung chung cho 3 vai tro: the ho so + cac nhom o chuc nang.
// sections: [{ title, tiles: [{ key, title, description, meta?, upcoming?, onPress? }] }]
export default function RoleHome({ user, theme, onLogout, profileLines, notice, hero, sections }) {
  return (
    <Screen
      title="EDMS Nhân viên"
      subtitle={theme.label}
      accent={theme.color}
      right={<Button title="Đăng xuất" variant="onDark" size="sm" onPress={onLogout} />}
    >
      <ProfileCard user={user} theme={theme} lines={profileLines} />
      {hero}
      <Banner tone="info">{notice}</Banner>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionTitle>{section.title}</SectionTitle>
          <TileGrid
            items={section.tiles}
            renderTile={(tile, width) => (
              <FeatureTile
                key={tile.key}
                width={width}
                accent={theme.color}
                title={tile.title}
                short={tile.short}
                description={tile.description}
                meta={tile.meta}
                upcoming={tile.upcoming}
                onPress={tile.onPress}
              />
            )}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
});
