# airvantage-ussd
Simple nodejs web application to receive USSD

## Getting started
> :bulb: Nodejs >= 4.x required

1. Install the dependencies `npm i`
2. Start the server `npm start`
3. Go to http://localhost:3000/ and prepare to watch the USSD coming
4. Test by posting content on http://localhost:3000/
     
  ```bash
  curl -H "Content-Type: application/json" -X POST -d '{"msisdn":"+33757248236","ussdstring":"26","sessionid":"13334364","encoding":"15"}' http://localhost:3000/
  ```


