OpenAid
=======

Project at MakeOpenData March 2013, work in progress.

Heroku
------

    heroku apps:create open-aid
    heroku addons:add pointdns:developer
    heroku domains:add openaid.ch
    heroku domains:add www.openaid.ch
    git push heroku master
