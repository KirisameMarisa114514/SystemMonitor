import { ADAPTERS } from "./adapters.js";
import { API_CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(message, status = 0, endpoint = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class MonitorApi {
  constructor(config = API_CONFIG) {
    this.config = config;
    this.controllers = new Set();
  }

  async request(endpoint, query = "") {
    const controller = new AbortController();
    this.controllers.add(controller);
    const timer = window.setTimeout(() => controller.abort(), this.config.timeoutMs);
    const url = `${this.config.baseUrl}${endpoint}${query}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ApiError(`接口返回 ${response.status}`, response.status, endpoint);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.name === "AbortError") {
        throw new ApiError("请求超时", 0, endpoint);
      }
      throw new ApiError(error.message || "网络请求失败", 0, endpoint);
    } finally {
      window.clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }

  async getSnapshot() {
    const endpointEntries = Object.entries(this.config.endpoints);
    const requests = endpointEntries.map(([key, endpoint]) => {
      const query = key === "processes" ? `?limit=${this.config.processLimit}` : "";
      return this.request(endpoint, query);
    });
    const settled = await Promise.allSettled(requests);
    const data = {};
    const errors = {};

    settled.forEach((result, index) => {
      const [key] = endpointEntries[index];
      if (result.status === "fulfilled") {
        try {
          data[key] = ADAPTERS[key](result.value);
        } catch (error) {
          errors[key] = new ApiError(`响应数据格式无效：${error.message}`, 0, endpointEntries[index][1]);
        }
      } else {
        errors[key] = result.reason;
      }
    });

    return {
      data,
      errors,
      successCount: Object.keys(data).length,
      totalCount: endpointEntries.length,
    };
  }

  destroy() {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }
}
