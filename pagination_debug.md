# Pagination Fix for useTimeLogs.ts

The issue is that the API `/api/time-logs/recent` likely doesn't support `offset` parameter.

## Quick Test to Debug

Add this console.log to see what's happening when you click the arrows:

In `src/hooks/useTimeLogs.ts`, around line 263-276, update the pagination functions:

```typescript
// Pagination functions  
const goNextPage = async () => {
    console.log('goNextPage clicked! Current pageIndex:', pageIndex, 'hasMore:', hasMore);
    if (!hasMore) {
        console.log('No more pages available');
        return;
    }
    const nextPage = pageIndex + 1;
    setPageIndex(nextPage);
    console.log('Fetching next page, offset:', nextPage * 3);
    await fetchRecentLogs(3, nextPage * 3);
};

const goPrevPage = async () => {
    console.log('goPrevPage clicked! Current pageIndex:', pageIndex);
    if (pageIndex === 0) {
        console.log('Already at first page');
        return;
    }
    const prevPage = pageIndex - 1;
    setPageIndex(prevPage);
    console.log('Fetching prev page, offset:', prevPage * 3);
    await fetchRecentLogs(3, prevPage * 3);
};
```

After adding these console.logs, open your browser's Developer Tools (F12), go to the Console tab, and click the arrows. This will tell us if:
1. The functions are being called at all
2. What the pageIndex and hasMore values are
3. Whether it's reaching the API call

Share what you see in the console and I can provide the exact fix needed.
