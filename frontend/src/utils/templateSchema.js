export const templateSchema = {
  dimensions: {
    width: 1920,
    height: 1080,
  },
  colors: {
    background: "#0a0a0c",
    primaryAccent: "#00E5FF",
    text: "#ffffff",
    secondaryText: "#a0a0ab",
  },
  elements: {
    header: {
      text: "CERTIFICATE OF APPRECIATION",
      fontFamily: "Inter, sans-serif",
      fontWeight: "900",
      fontSize: 48,
      color: "#00E5FF",
      y: 200,
      spacing: 30,
    },
    subHeader: {
      text: "PROUDLY PRESENTED TO",
      fontFamily: "Inter, sans-serif",
      fontWeight: "600",
      fontSize: 20,
      color: "#a0a0ab",
      spacing: 50,
    },
    recipientName: {
      fontFamily: "Playfair Display, Georgia, serif",
      fontWeight: "bold",
      baseSize: 64,
      minSize: 28,
      maxWidth: 1400,
      color: "#ffffff",
      spacing: 60,
    },
    description: {
      fontFamily: "Inter, sans-serif",
      fontWeight: "400",
      baseSize: 22,
      minSize: 16,
      maxWidth: 1200,
      lineHeight: 36,
      color: "#e4e4e7",
      spacing: 80,
    },
    footerLine: {
      text: "Authorized Representative • CopterCode Cohort Registry Division",
      fontFamily: "Inter, sans-serif",
      fontWeight: "500",
      fontSize: 16,
      color: "#71717a",
      y: 880,
    }
  }
};
