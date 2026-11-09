import React, { useState } from "react";
import { AnimatedSplash } from "./src/components/AnimatedSplash";
import RootLayout from "./app/_layout";

export default function App() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <AnimatedSplash onFinish={() => setLoading(false)} />;
  }

  return <RootLayout />;
}
