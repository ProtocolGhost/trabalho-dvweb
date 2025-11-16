import axios from "axios";

const api = axios.create({
  baseURL: "http://26.53.188.133:3000/",
});

export default api;