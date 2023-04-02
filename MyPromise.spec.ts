import { it, describe, expect, vi } from "vitest";
import { MyPromise } from "./MyPromise";

it("nested promise resolution", async () => {
  const pr1 = new MyPromise((resolve, reject) => {
    resolve("pr1");
  });

  const pr2 = new MyPromise((resolve, reject) => {
    resolve("pr2");
  });

  const p = new MyPromise((resolve, reject) => {
    setTimeout(() => {
      resolve(pr1);
    }, 500);
  });

  return p
    .then((v) => {
      expect(v).toBe("pr1");
      return pr2;
    })
    .catch()
    .then((v) => {
      expect(v).toBe("pr2");
    });
});

it("promise chaining resolution", () => {
  new MyPromise((resolve, reject) => {
    setTimeout(() => {
      resolve("result");
    }, 500);
  })
    .then((v) => {
      expect(v).toBe("result");
      return "next result";
    })
    .then((v) => {
      expect(v).toBe("next result");
    });
});

it("same promise, multiple callbacks", async () => {
  const p = new MyPromise((resolve, reject) => {
    setTimeout(() => {
      resolve("result");
    }, 500);
  });
  return p.then((v) => {
    expect(v).toBe("result");
  });
});

it("then fn callback is called even if promise status id equal to fulfilled", () => {
  const p = new MyPromise((resolve, reject) => {
    resolve("result");
  });
  p.then((v) => {
    expect(v).toBe("result");
  });
});

it("finally then fn callback is called with previouse value", () => {
  new MyPromise((resolve, reject) => {
    resolve("result");
  })
    .finally(() => {
      return "ok";
    })
    .then((v) => {
      expect(v).toEqual("result");
      expect(v).not.toEqual("ok");
    });
});

it("finally catch fn callback is called with error value", () => {
  new MyPromise((resolve, reject) => {
    resolve("result");
  })
    .finally(() => {
      throw "err";
    })
    .catch((error) => {
      expect(error).toEqual("err");
    });
});

it("calling static resolve function should create a resolved promise", () => {
  MyPromise.resolve("someValue").then((value) => {
    expect(value).toEqual("someValue");
  });
});

it("calling static reject function should create a rejected promise", () => {
  MyPromise.reject("error message").catch((error) => {
    expect(error).toEqual("error message");
  });
});

it("calling static all function with resolved promises should return an array of results", async () => {
  const p1 = MyPromise.resolve(1);
  const p2 = MyPromise.resolve(2);
  const p3 = MyPromise.resolve(3);

  return MyPromise.all([p1, p2, p3]).then((results) => {
    expect(results).toEqual([1, 2, 3]);
  });
});

it("calling static all function with rejected promises should call catch cb with an error", () => {
  const p1 = MyPromise.reject("error");
  const p2 = MyPromise.resolve("2");
  const p3 = MyPromise.resolve("3");

  MyPromise.all([p1, p2, p3]).catch((error) => {
    expect(error).toEqual("error");
  });
});

it("calling static allSettled function with rejected promises should return results as expected", () => {
  const p1 = MyPromise.reject("error");
  const p2 = MyPromise.resolve("2");
  const p3 = MyPromise.resolve("3");

  MyPromise.allSettled([p1, p2, p3]).then((results) => {
    expect(results).toEqual([
      { status: "rejected", reason: "error" },
      { status: "fulfilled", value: "2" },
      { status: "fulfilled", value: "3" },
    ]);
  });
});

it("calling reject should skip then cb and call catch cb with an error", () => {
  const mockCb = vi.fn();

  new MyPromise((resolve, reject) => {
    reject("error");
  })
    .then(mockCb)
    .catch((err) => {
      expect(err).toEqual("error");
      expect(mockCb).not.toHaveBeenCalled();
    });
});

it("calling resolve should skip catch cb and call then cb with a value", () => {
  const mockCb = vi.fn();

  new MyPromise((resolve, reject) => {
    resolve("value");
  })
    .catch(mockCb)
    .then((res) => {
      expect(res).toEqual("value");
      expect(mockCb).not.toHaveBeenCalled();
    });
});

it("calling static 'race' function with resolved promises should call then cb with the fastest promise resolved", async () => {
  const mockCb = vi.fn();

  const p1 = new MyPromise((resolve, reject) => {
    setTimeout(() => resolve("fast"), 100);
  });
  const p2 = new MyPromise((resolve, reject) => {
    setTimeout(() => resolve("slow"), 200);
  });

  return MyPromise.race([p1, p2])
    .catch(mockCb)
    .then((res) => {
      expect(res).toEqual("fast");
      expect(mockCb).not.toHaveBeenCalled();
    });
});

it("calling static 'race' function with a slow resolved and a fast rejected promises should call resected cb with the error", async () => {
  const mockCb = vi.fn();

  const p1 = new MyPromise((resolve, reject) => {
    setTimeout(() => reject("fast-reject"), 100);
  });
  const p2 = new MyPromise((resolve, reject) => {
    setTimeout(() => resolve("slow-resolve"), 200);
  });

  return MyPromise.race([p1, p2])
    .then(mockCb)
    .catch((error) => {
      expect(error).toEqual("fast-reject");
      expect(mockCb).not.toHaveBeenCalled();
    });
});

it("calling static 'any' function with a slow resolved and a fast rejected promises should call slow resolved cb with a value", async () => {
  const mockCb = vi.fn();

  const p1 = new MyPromise((resolve, reject) => {
    setTimeout(() => reject("fast-reject"), 100);
  });
  const p2 = new MyPromise((resolve, reject) => {
    setTimeout(() => resolve("slow-resolve"), 200);
  });

  return MyPromise.any([p1, p2])
    .catch(mockCb)
    .then((res) => {
      expect(res).toEqual("slow-resolve");
      expect(mockCb).not.toHaveBeenCalled();
    });
});

it("calling static 'any' function with rejected promises should call catch cb with an aggregation error message", async () => {
  const mockCb = vi.fn();

  const p1 = new MyPromise((resolve, reject) => {
    setTimeout(() => reject("fast-reject"), 100);
  });
  const p2 = new MyPromise((resolve, reject) => {
    setTimeout(() => reject("slow-rejected"), 200);
  });

  return MyPromise.any([p1, p2])
    .then(mockCb)
    .catch((res) => {
      expect(res).toEqual("All promises were rejected");
      expect(mockCb).not.toHaveBeenCalled();
    });
});
