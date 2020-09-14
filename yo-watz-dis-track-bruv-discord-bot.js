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
const AUDIO_FILE_DIR = '/tmp';


class Silence extends Readable {
    _read() {
        this.push(Buffer.from([0xF8, 0xFF, 0xFE]));
    }
}

client.on('message', async message => {
	// Join the same voice channel of the author of the message
	
	if(['!track', '!trackdebug'].indexOf(message.content) > -1)  {
        const debug = message.content === '!trackdebug';
        try {
            message.channel.send('listening...');
            if (message.member.voice.channel) {
                const connection = await message.member.voice.channel.join();
                connection.play(new Silence(), { type: 'opus' });// start sending silence otherwise we can't receive!

                const user = client.users.cache.find(u => u.username === RADIO_USERNAME);


                const audioStream = connection.receiver.createStream(user, {mode: 'pcm', end: "manual"});
                const path = AUDIO_FILE_DIR + '/watzdistrack_audio_' + (new Date().getTime());
                audioStream.pipe(fs.createWriteStream(path));

                setTimeout(function() {
                    message.member.voice.channel.leave();
                    message.channel.send('let me think...');

                    exec(CONVERT_CMD.replace('%pcmpath%', path).replace('%wavpath%', path + '.wav'), (error, stdout, stderr) => {
                        console.log(stdout);
                    }).on('close', function () {
                        exec_recognize(RECOGNIZER_CMD,
                            path + '.wav',
                            debug,
                            msg => {message.channel.send(msg)}, // printout
                            path => del_recording, // onsuccess
                            function() { // onfail
                                exec_recognize(RECOGNIZER_CMD2,
                                    path + '.wav',
                                    debug,
                                    msg => {message.channel.send(msg)}, // printout
                                    path => del_recording // onsuccess
                                );
                            }
                        );
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
        console.error(err);
    }
}

function exec_recognize(cmd_template, path, debug, printout, onsuccess, onfail) {
    const cmd = cmd_template.replace('%path%', path);
    debug && printout('try recognize with cmd: ' + cmd);

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.log(`oh dear: ${error.message}`);
            debug && printout(`oh dear: ${error.message}`);
            onfail && onfail();
            return;
        }
        if (stderr) {
            console.log(`oh dear: ${stderr}`);
            debug && printout(`oh dear: ${stderr}`);
            onfail && onfail();
            return;
        }
        if(stdout.indexOf('The best match is' > -1)) {
            console.log(stdout.split("\n"));
            printout(stdout.split("\n")[0]);
            onsuccess && onsuccess();
        } else {
            debug && printout('failed');
            onfail && onfail();
        }
    });
}

const bot_secret_token = "";
client.login(bot_secret_token);
