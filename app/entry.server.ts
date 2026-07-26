import { router } from "./router.ts";

export default {
  fetch(request: Request) {
    return router.fetch(request);
  },
};
