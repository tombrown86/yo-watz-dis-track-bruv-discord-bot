const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const { spawn } = require('child_process');


const RADIO_USERNAME = 'radio nv';
const SNIPPET_LENGTH_SECS = 10;
const RECOGNIZER_CMD = `python3 /home/tom/repos/freezam/interface.py -vb identify --pathfile="{0}" --type=1`;
const RECOGNIZER_CMD2 = `python3 /home/tom/repos/freezam/interface.py -vb identify --pathfile="{0}" --type=2`;

client.on('message', async message => {
	// Join the same voice channel of the author of the message
	
	if(['!track'].indexOf(receivedMessage.content) > -1)  {
		receivedMessage.channel.send('yo watz dis track bruv?? listening...');
		if (message.member.voice.channel) {
            const connection = await message.member.voice.channel.join();
            const user = client.users.find("username", RADIO_USERNAME);
            const audioStream = connection.receiver.createStream(user, {mode: 'pcm', end: "manual"});
            const path = '/tmp/watzdistrack_audio_'+(new Date().getTime());
            audioStream.pipe(fs.createWriteStream(path));

            setTimeout(function() {
                exec_recognize(RECOGNIZER_CMD, path, receivedMessage.channel.send, function() {exec_recognize(RECOGNIZER_CMD2, path, receivedMessage.channel.send)});
            }, SNIPPET_LENGTH_SECS * 1000 /*milliseconds*/)
		} else {
            receivedMessage.channel.send('ask me in voice channel init plz');
        }
	}
});

function exec_recognize(cmd_template, path, out, onfail) {
    const cmd = String.format(cmd_template, path);
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            out(`oh dear: ${error.message}`);
            onfail && onfail();
            return;
        }
        if (stderr) {
            out(`oh dear: ${stderr}`);
            onfail && onfail();
            return;
        }
        
        if(stdout.indexOf('The best match is' > -1)) {
            out(stdout.split('\n')[0]);
        } else {
            onfail && onfail();
        }
    });
}

const bot_secret_token = "";
client.login(bot_secret_token);
