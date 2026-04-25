import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import Home from "@/pages/Home";
import Loading from "@/pages/Loading";
import Verdict from "@/pages/Verdict";

const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/verdict" element={<Verdict />} />
      </Routes>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
