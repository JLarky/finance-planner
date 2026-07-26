import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import { userId, redirectToLogin } from "../middleware/auth-session.ts";
import { routes } from "../routes.ts";
import { getUser } from "../data/users.ts";
import { HomePage } from "../ui/home-page.tsx";
import { LoginPage } from "../ui/login-page.tsx";
import { DashboardPage } from "../ui/dashboard-page.tsx";
export default createController(routes, {
  actions: {
    async home(c) {
      return c.render(<HomePage signedIn={userId(c.session) != null} />);
    },
    async login(c) {
      const id = userId(c.session);
      const url = new URL(c.request.url);
      const returnTo = url.searchParams.get("returnTo") || "/app";
      if (id) return redirect(returnTo);
      return c.render(<LoginPage returnTo={returnTo} error={url.searchParams.get("error")} />);
    },
    async app(c) {
      const id = userId(c.session);
      if (!id) return redirectToLogin(routes.app.href());
      const user = await getUser(id);
      if (!user) return redirectToLogin(routes.app.href());
      return c.render(<DashboardPage user={user} />);
    },
    async logout(c) {
      c.session.unset("userId");
      c.session.regenerateId();
      return redirect(routes.home.href());
    },
  },
});
