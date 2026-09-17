export const number = (value: number) => Math.round(value).toLocaleString("ko-KR");
export const won = (value: number) => `₩${number(value)}`;
export const percent = (value: number) => `${value.toFixed(1)}%`;
