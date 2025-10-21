export const metadata = { title: "Flappy Mini" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* important for mobile iframe fit */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#0a0713",
          color: "#fff",
          height: "100dvh",
          overflow: "hidden",     // 💡 kill scrollbars
        }}
      >
        {children}
      </body>
    </html>
  );
}
