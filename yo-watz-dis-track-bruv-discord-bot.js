const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const { exec } = require('child_process');
const { Readable } = require('stream');


//const RADIO_USERNAME = 'radio nv';
const RADIO_USERNAME = 'tombrown86';
const SNIPPET_LENGTH_SECS = 20;
const CONVERT_CMD = `ffmpeg -f s16le -ar 48k -ac 2 -i %pcmpath% %wavpath%`;
const RECOGNIZER_CMD = `python3 /home/tom/repos/freezam/interface.py identify --pathfile="%path%" --type=2`; // 2 is better apparently
const RECOGNIZER_CMD2 = `python3 /home/tom/repos/freezam/interface.py identify --pathfile="%path%" --type=1`;


class Silence extends Readable {
    _read() {
        this.push(Buffer.from([0xF8, 0xFF, 0xFE]));
    }
}

client.on('message', async message => {
	// Join the same voice channel of the author of the message
	
	if(['!track', '!trackdebug'].indexOf(message.content) > -1)  {
        try {
            message.channel.send('listening...');
            if (message.member.voice.channel) {
                const connection = await message.member.voice.channel.join();
                connection.play(new Silence(), { type: 'opus' });// start sending silence otherwise we can't receive!

                const user = client.users.cache.find(u => u.username === RADIO_USERNAME);


                const audioStream = connection.receiver.createStream(user, {mode: 'pcm', end: "manual"});
                const path = '/tmp/watzdistrack_audio_'+(new Date().getTime());
                audioStream.pipe(fs.createWriteStream(path));

                setTimeout(function() {
                    message.member.voice.channel.leave();
                    message.channel.send('let me think...');
                    

                    exec(CONVERT_CMD.replace('%pcmpath%', path).replace('%wavpath%', path + '.wav'), (error, stdout, stderr) => {
                        console.log(stdout);
                    }).on('close', function () {
                        exec_recognize(RECOGNIZER_CMD, path + '.wav', msg => {message.channel.send(msg)},
                            // onsuccess
                            path => del_recording, 
                            // onfail
                            function() {exec_recognize(RECOGNIZER_CMD2, path + '.wav',  msg => {message.channel.send(msg)}, path => del_recording)
                        });
                    });
                }, SNIPPET_LENGTH_SECS * 1000)
            } else {
                message.channel.send('ask in a voice channel init plz');
            }
        } catch(err) {
            console.log(err);
            message.channel.send(message.content === '!trackdebug' ? 'oh dear:' + err  : "unable to listen to " + RADIO_USERNAME + ':-(');
        }
	}
});

function del_recording(path) {
    try {
        fs.unlinkSync(path);
        fs.unlinkSync(path + '.wav');
    } catch(err) {
        console.error(err)
    }
}

function exec_recognize(cmd_template, path, out, onsuccess, onfail) {
    const cmd = cmd_template.replace('%path%', path);
    out(cmd);

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.log(`oh dear: ${error.message}`);
            out(`oh dear: ${error.message}`);
            onfail && onfail();
            return;
        }
        if (stderr) {
            console.log(`oh dear: ${stderr}`);
            out(`oh dear: ${stderr}`);
            onfail && onfail();
            return;
        }
        
        if(stdout.indexOf('The best match is' > -1)) {
            console.log(stdout.split("\n"));
            out(stdout.split("\n")[0]);
            onsuccess && onsuccess();
        } else {
            onfail && onfail();
        }


    });
}

const bot_secret_token = "";
client.login(bot_secret_token);
