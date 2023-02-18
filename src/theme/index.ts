import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
  // fonts: {
  //   heading: "Inter",
  //   body: "Inter",
  // },
}
export default extendTheme(config);