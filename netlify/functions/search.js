exports.handler = async (event) => {

    const q = event.queryStringParameters.q;

    const response = await fetch(
        "https://api.search.brave.com/res/v1/web/search?q=" +
        encodeURIComponent(q),
        {
            headers:{
                "Accept":"application/json",
                "X-Subscription-Token":process.env.BRAVE_API_KEY
            }
        }
    );

    const json = await response.json();

    const results = (json.web?.results || []).map(r => ({
        title: r.title,
        url: r.url,
        description: r.description
    }));

    return {
        statusCode:200,
        body:JSON.stringify({results})
    };

};
