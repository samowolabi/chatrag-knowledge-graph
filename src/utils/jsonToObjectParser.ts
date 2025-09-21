export function jsonToObject(payload: string | any): any {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  
  if (Array.isArray(payload)) {
    return payload.map(item => jsonToObject(item));
  }
  
  if (payload && typeof payload === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(payload)) {
      result[key] = jsonToObject(value);
    }
    return result;
  }
  
  return payload;
}
