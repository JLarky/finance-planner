import { post, route } from "remix/routes";

export const routes = route({
  home: "/",
  login: "/login",
  app: "/app",
  logout: post("logout"),
  devLogin: post("dev-login"),
  api: route("api", {
    auth: route("auth", {
      registerOptions: post("register/options"),
      registerVerify: post("register/verify"),
      loginOptions: post("login/options"),
      loginVerify: post("login/verify"),
    }),
  }),
});
