import { measureExecutionTime, debounce, throttle, memoize } from './performanceHelper';

describe('Performance Helper', () => {
  describe('measureExecutionTime', () => {
    it('should measure the execution time of a function', () => {
      const [result, time] = measureExecutionTime(() => {
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += i;
        }
        return sum;
      });
      expect(result).toBe(499999500000);
      expect(time).toBeGreaterThan(0);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce a function', () => {
      const func = jest.fn();
      const debouncedFunc = debounce(func, 1000);

      debouncedFunc();
      debouncedFunc();
      debouncedFunc();

      jest.advanceTimersByTime(500);
      expect(func).not.toBeCalled();

      jest.advanceTimersByTime(500);
      expect(func).toBeCalledTimes(1);
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle a function', () => {
      const func = jest.fn();
      const throttledFunc = throttle(func, 1000);

      throttledFunc();
      throttledFunc();
      throttledFunc();

      jest.advanceTimersByTime(500);
      expect(func).toBeCalledTimes(1);

      jest.advanceTimersByTime(500);
      expect(func).toBeCalledTimes(2);
    });
  });

  describe('memoize', () => {
    it('should memoize a function', () => {
      const func = jest.fn((x) => x * 2);
      const memoizedFunc = memoize(func);

      expect(memoizedFunc(2)).toBe(4);
      expect(memoizedFunc(2)).toBe(4);
      expect(func).toBeCalledTimes(1);

      expect(memoizedFunc(3)).toBe(6);
      expect(func).toBeCalledTimes(2);
    });
  });
});
