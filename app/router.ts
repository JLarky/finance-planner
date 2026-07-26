import { createRouter, type MiddlewareContext } from "remix/router";
import { staticFiles } from "remix/middleware/static";
import controller from "./actions/controller.tsx";
import authController from "./actions/api/auth/controller.ts";
import { authSession } from "./middleware/auth-session.ts";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";
type Context = MiddlewareContext<[ReturnType<typeof authSession>, ReturnType<typeof render>]>;
declare module "remix/router" {
  interface RouterTypes {
    context: Context;
  }
}
export const router = createRouter<Context>({
  middleware: [staticFiles("./public", { index: false }), authSession(), render()],
});
router.map(routes, controller);
router.map(routes.api.auth, authController);
