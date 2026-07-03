import { Navigate } from "@tanstack/react-router";

function App() {
  return (
    <Navigate
      to="/by-index/$index"
      params={{ index: "1" }}
      search={{ thumbnail: false, lang: undefined }}
    />
  );
}

export default App;
