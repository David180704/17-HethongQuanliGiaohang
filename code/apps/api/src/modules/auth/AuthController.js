import { ok, created } from "../../core/response.js";

// Chi dich HTTP <-> AuthService. Moi luat nghiep vu nam trong service.
export class AuthController {
  /** @param {import("./AuthService.js").AuthService} authService */
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res) => ok(res, await this.authService.login(req.body || {}));

  register = async (req, res) => created(res, await this.authService.register(req.body || {}));

  me = async (req, res) => ok(res, await this.authService.getProfile(req.user.id));

  refresh = async (req, res) => ok(res, await this.authService.refresh(req.body || {}));

  logout = async (req, res) => {
    await this.authService.logout(req.body || {});
    return ok(res, { loggedOut: true });
  };

  logoutAll = async (req, res) => {
    await this.authService.logoutAll(req.user.id);
    return ok(res, { loggedOut: true });
  };
}
