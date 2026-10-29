import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./api/client";
import { routes } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: { queries: {
      // 4xx 는 다시 시도해도 같으니 건너뛰고, 네트워크·서버 오류는 한 번만 더 시도한다.
      retry: (count, err) => {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
        return count < 1;
      },
      refetchOnWindowFocus: false,
    } },
});
const router = createBrowserRouter(routes);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
