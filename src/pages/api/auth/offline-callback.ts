import { ApiRequest, NextApiResponse } from '@types';

import Shopify from '@lib/shopify';
import { writeEnvToFile } from './../../../../writeEnvToFile';

export default async function handler(req: ApiRequest, res: NextApiResponse) {
	try {
		const session = await Shopify.Auth.validateAuthCallback(
			req,
			res,
			req.query
		);

		if (
			process.env.NODE_ENV === 'development' &&
			session.shop === process.env.SHOP
		) {
			writeEnvToFile([
				{ key: 'APP_OFFLINE_ACCESSTOKEN', value: session.accessToken as string },
			]);
		}

		const webhooks = await Shopify.Webhooks.Registry.registerAll({
			shop: session.shop,
			accessToken: session.accessToken as string,
		});

		Object.keys(webhooks).forEach((webhook) => {
			if (webhooks[webhook].success === true) {
				console.log(`Registered ${webhook} webhook`);
			} else {
				console.log(
					`Failed to register ${webhook} webhook: ${webhooks.result}`
				);
			}
		});

		res.redirect(`/?host=${req.query.host}&shop=${req.query.shop}`);
	} catch (e: any) {
		console.warn(e);
		switch (true) {
			case e instanceof Shopify.Errors.InvalidOAuthError:
				res.status(400);
				res.send(e.message);
				break;
			case e instanceof Shopify.Errors.CookieNotFound:
			case e instanceof Shopify.Errors.SessionNotFound:
				// This is likely because the OAuth session cookie expired before the merchant approved the request
				res.redirect(`/api/auth?shop=${req.query.shop}`);
				break;
			default:
				res.status(500);
				res.send(e.message);
				break;
		}
	}
}
