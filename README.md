# Display Dashboard for AWS Connect Call Center

1. Clone repo
2. Install packages `npm i`
3. Copy `.env` to `.env.local`
4. Create AWS User in IAM with Permission `AmazonConnectReadOnlyAccess`
5. Fill out access keys, region, and AWS Connect instance GUID in `.env.local`
6. Cusomtize metrics to be displayed on dashboard using and threshold for colors using `REACT_APP_QUADRANT_#_METRIC_XXX` variables in `.env.local`
7. Run `npm run build`